import { initJsPsych } from "jspsych";
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import SurveyHtmlFormPlugin from "@jspsych/plugin-survey-html-form";
import PipePlugin from "@jspsych-contrib/plugin-pipe";
import "jspsych/css/jspsych.css";
import "./styles.css";
import TwoSliderResponsePlugin from "./plugins/two-slider-response.js";
import {
  DATAPIPE_EXPERIMENT_ID,
  PROLIFIC_PARAMETER_NAMES,
  buildParticipantRecord,
  conditionIdFromPipeResult,
  dataFilename,
  hasAnyProlificParameter,
  isAcceptedSaveResult,
  isCompleteProlificSession,
  prolificParametersFromSearch,
  saveErrorCode,
  submissionIdFromProlificParameters,
} from "./data-collection.js";
import {
  CONDITIONS,
  QUESTION_TYPES,
  combinedRatingStimulus,
  conditionFromId,
} from "./stimuli.js";

const STUDY_VERSION = "norming-1.0.0-main";
const SESSION_STORAGE_KEY = "norming-main-session-v1";
const LOCAL_STORAGE_KEY_PREFIX = "norming-main-session-v1:";
const PROLIFIC_COMPLETION_URL =
  "https://app.prolific.com/submissions/complete?cc=C1GHDDD8";
const PROLIFIC_PREVIEW_URL = "https://www.prolific.com/";
const PROLIFIC_REDIRECT_DELAY_MS = 1200;
const root = document.querySelector("#experiment-root");
const query = new URLSearchParams(window.location.search);
const prolific = prolificParametersFromSearch(query);
const hasAnyProlific = hasAnyProlificParameter(prolific);
const isDataCollectionSession = isCompleteProlificSession(prolific);

if (hasAnyProlific && !isDataCollectionSession) {
  const missingParameters = PROLIFIC_PARAMETER_NAMES.filter(
    (name) => !query.get(name)?.trim(),
  );

  root.innerHTML = `
    <div class="static-final-screen">
      <section class="experiment-column">
        <h1>Study link error</h1>
        <p>This study link is missing required Prolific information and cannot begin.</p>
        <p>Missing: ${missingParameters.join(", ")}</p>
        <p>Please return to Prolific and open the study link again.</p>
      </section>
    </div>
  `;
} else {
  runExperiment();
}

function runExperiment() {
  const previewCondition = conditionFromId(query.get("condition"));
  let submissionId = isDataCollectionSession
    ? submissionIdFromProlificParameters(prolific)
    : undefined;
  let storedSession = readStoredSession();
  const participantUuid = storedSession?.participantUuid ?? crypto.randomUUID();
  submissionId ??= participantUuid;
  let consentGiven = false;
  let assignmentFailed = false;
  let saveAccepted = !isDataCollectionSession;
  let selectedCondition;
  let assignmentSource;

  if (storedSession?.saveAccepted) {
    renderStaticScreen(recordedCompletionContent());
    scheduleProlificRedirect();
    return;
  }

  const jsPsych = initJsPsych({
    display_element: root,
    on_finish: () => {
      const finalContent = consentGiven
        ? recordedCompletionContent()
        : `
            <section class="experiment-column">
              <h1>Study ended</h1>
              <p>You chose not to participate. No study responses were collected.</p>
            </section>
          `;

      renderStaticScreen(finalContent);

      if (consentGiven && saveAccepted) {
        scheduleProlificRedirect();
      }

      if (!isDataCollectionSession && consentGiven) {
        console.info(
          "Preview data (not uploaded)",
          buildParticipantRecord(jsPsych.data.get().values()),
        );
      }
    },
  });

  const restoredQuestionOrder = validQuestionOrder(storedSession?.questionOrder)
    ? storedSession.questionOrder
    : undefined;
  const questionOrder =
    restoredQuestionOrder ?? jsPsych.randomization.shuffle([...QUESTION_TYPES]);

  jsPsych.data.addProperties({
    participant_uuid: participantUuid,
    study_version: STUDY_VERSION,
    collection_mode: isDataCollectionSession ? "main" : "preview",
    prolific_pid: isDataCollectionSession ? prolific.prolificPid : null,
    prolific_study_id: isDataCollectionSession ? prolific.studyId : null,
    prolific_session_id: isDataCollectionSession ? prolific.sessionId : null,
  });

  if (previewCondition) {
    applyCondition(previewCondition, "url-forced");
  } else if (isDataCollectionSession) {
    const restoredCondition = conditionFromId(storedSession?.conditionId);

    if (restoredCondition) {
      applyCondition(
        restoredCondition,
        storedSession.assignmentSource ?? "datapipe-sequential-resume",
      );
    }
  } else {
    const randomCondition = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
    applyCondition(randomCondition, "local-random");
  }

  persistSession({ participantUuid, questionOrder });

  function recordedCompletionContent() {
    const returnUrl = prolificReturnUrl();

    return `
      <section class="experiment-column static-completion">
        <p>Thank you for completing this study. Your response has been recorded.</p>
        <p>You should be redirected to Prolific automatically.</p>
        <p>
          <a class="jspsych-btn return-to-prolific" href="${returnUrl}">
            Return to Prolific
          </a>
        </p>
      </section>
    `;
  }

  function prolificReturnUrl() {
    return isDataCollectionSession ? PROLIFIC_COMPLETION_URL : PROLIFIC_PREVIEW_URL;
  }

  function scheduleProlificRedirect() {
    window.setTimeout(() => {
      window.location.assign(prolificReturnUrl());
    }, PROLIFIC_REDIRECT_DELAY_MS);
  }

  function renderStaticScreen(content) {
    root.innerHTML = `
      <div class="static-final-screen">
        ${content}
      </div>
    `;
  }

  function applyCondition(condition, source) {
    selectedCondition = condition;
    assignmentSource = source;

    jsPsych.data.addProperties({
      assignment_source: assignmentSource,
      condition_id: selectedCondition.id,
      item: selectedCondition.item,
      prior: selectedCondition.prior,
    });

    persistSession({
      participantUuid,
      questionOrder,
      conditionId: selectedCondition.id,
      assignmentSource,
    });
  }

  function readStoredSession() {
    if (!isDataCollectionSession) {
      return undefined;
    }

    return readBrowserStoredSession(sessionStorage, SESSION_STORAGE_KEY)
      ?? readBrowserStoredSession(localStorage, localStorageKey());
  }

  function persistSession(updates) {
    if (!isDataCollectionSession) {
      return;
    }

    const persistentSession = readBrowserStoredSession(localStorage, localStorageKey());
    const saveWasAccepted =
      persistentSession?.saveAccepted || storedSession?.saveAccepted || updates.saveAccepted;

    storedSession = {
      ...persistentSession,
      ...storedSession,
      ...updates,
      prolificPid: prolific.prolificPid,
      studyId: prolific.studyId,
      sessionId: prolific.sessionId,
      saveAccepted: saveWasAccepted || false,
    };

    writeBrowserStoredSession(sessionStorage, SESSION_STORAGE_KEY, storedSession);
    writeBrowserStoredSession(localStorage, localStorageKey(), storedSession);
  }

  function readBrowserStoredSession(storage, key) {
    try {
      const parsed = JSON.parse(storage.getItem(key));
      const matchesCurrentSession =
        parsed?.prolificPid === prolific.prolificPid &&
        parsed?.studyId === prolific.studyId &&
        parsed?.sessionId === prolific.sessionId;

      return matchesCurrentSession ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  function writeBrowserStoredSession(storage, key, session) {
    try {
      storage.setItem(key, JSON.stringify(session));
    } catch {
      // The experiment can continue if browser storage is unavailable.
    }
  }

  function localStorageKey() {
    return `${LOCAL_STORAGE_KEY_PREFIX}${submissionId}`;
  }

  const consent = {
    type: HtmlButtonResponsePlugin,
    stimulus: `
      <section class="consent-screen">
        <h1>Consent to Participate in Research</h1>
        <p>You are being invited to take part in a research study about how people understand short descriptions of everyday events. The study is conducted by researchers in linguistics at The Ohio State University.</p>
        <p>If you agree to participate, you will read a short written scenario and answer a small number of questions about how likely certain events are. The task should take about <strong>5 minutes</strong> to complete. Your participation is voluntary.</p>
        <p>You may stop participating at any time by closing the survey window or returning the study on Prolific. Some questions may require an answer in order to continue, but you are free to stop the study at any point.</p>
        <p>There are no expected risks beyond those normally associated with using a computer or completing an online survey. There are no direct benefits to you, but your responses may help researchers better understand how people interpret language.</p>
        <p>You will be paid through Prolific according to the payment information shown on the Prolific study page. To help us process payment and verify participation, we will collect your Prolific participant ID and basic technical information associated with the survey submission. We will not ask for your name, address, phone number, or other direct identifying information in the survey.</p>
        <p>Your responses will be used for research purposes. Data may be analyzed, presented, or shared in scientific contexts, but results will be reported in summary form and will not identify you personally. Because this is an online study, complete confidentiality cannot be guaranteed, but the research team will take reasonable steps to protect the data.</p>
        <p>This study has been reviewed by The Ohio State University Institutional Review Board. The study number is 2024B0317. If you have questions about the study, please contact Dongxu Wu at wu.6734@osu.edu. If you have questions about your rights as a research participant, or if you have questions, concerns, or suggestions that you do not feel comfortable discussing with the researcher, you may contact The Ohio State University Office of Responsible Research Practices at 614-688-8457 or 800-678-6251.</p>
        <p>By selecting <strong>"Yes, I agree to participate"</strong> and continuing to the survey, you confirm that you are at least 18 years old, that you have read this information, and that you voluntarily agree to participate in this research study.</p>
        <p class="question-text"><strong>Do you agree to participate?</strong></p>
      </section>
    `,
    choices: ["Yes, I agree to participate", "No, I do not agree to participate"],
    button_html: (choice) => `<button class="jspsych-btn consent-choice">${choice}</button>`,
    save_trial_parameters: { stimulus: false },
    data: { trial_kind: "consent" },
    on_finish: (data) => {
      consentGiven = data.response === 0;
      data.consent_given = consentGiven;

      if (!consentGiven) {
        jsPsych.abortExperiment();
      }
    },
  };

  const conditionAssignment = {
    type: PipePlugin,
    action: "condition",
    experiment_id: DATAPIPE_EXPERIMENT_ID,
    wait_message: "<p>Preparing the study. Please wait.</p>",
    data: { trial_kind: "condition_assignment" },
    on_finish: (data) => {
      const conditionId = conditionIdFromPipeResult(data.result, CONDITIONS.length);
      assignmentFailed = conditionId === undefined;
      data.assignment_valid = !assignmentFailed;

      if (!assignmentFailed) {
        applyCondition(CONDITIONS[conditionId], "datapipe-sequential");
      }
    },
  };

  const assignmentError = {
    type: HtmlButtonResponsePlugin,
    stimulus: `
      <section class="experiment-column">
        <h1>Connection problem</h1>
        <p>We could not prepare the study. Please check your internet connection and try again.</p>
      </section>
    `,
    choices: ["Try again"],
    save_trial_parameters: { stimulus: false },
    data: { trial_kind: "condition_assignment_retry" },
  };

  const conditionAssignmentLoop = {
    timeline: [
      {
        timeline: [conditionAssignment],
        conditional_function: () => isDataCollectionSession && !selectedCondition,
      },
      {
        timeline: [assignmentError],
        conditional_function: () => assignmentFailed,
      },
    ],
    loop_function: () => assignmentFailed,
  };

  const instructions = {
    type: HtmlButtonResponsePlugin,
    stimulus: `
      <section class="instruction-screen">
        <h1>Instructions</h1>
        <p>You will read one short description of an everyday situation.</p>
        <p>You will then answer two questions using sliders. There are no right or wrong answers. Please respond based <strong>only</strong> on the information in the description.</p>
        <p class="question-text"><strong>Are you ready to begin?</strong></p>
      </section>
    `,
    choices: ["Begin"],
    save_trial_parameters: { stimulus: false },
    data: { trial_kind: "instructions" },
  };

  const ratings = {
    type: TwoSliderResponsePlugin,
    stimulus: () => combinedRatingStimulus(selectedCondition, questionOrder),
    button_label: "Continue",
    data: {
      trial_kind: "rating",
    },
  };

  const demographics = {
    type: SurveyHtmlFormPlugin,
    preamble: `
      <section class="demographics-intro">
        <h1>Demographics</h1>
        <p>Finally, we would like to ask a few demographic questions. These questions are used only to describe the participant sample in aggregate for research purposes.</p>
        <p>Your answers on this page will <strong>not</strong> affect your payment. You will receive payment regardless of what you answer here, so please answer accurately.</p>
      </section>
    `,
    html: `
      <div class="demographics-form">
        <label class="demographic-field">
          <span class="question-text"><strong>1. How old are you?</strong></span>
          <span class="response-hint">Please enter your age in years.</span>
          <input type="number" name="age" min="18" max="120" inputmode="numeric" required />
          <span class="field-error" data-error-for="age" aria-live="polite"></span>
        </label>

        <label class="demographic-field">
          <span class="question-text"><strong>2. Which option best describes your gender?</strong></span>
          <select name="gender" required>
            <option value="" selected disabled>Select one</option>
            <option value="woman">Woman</option>
            <option value="man">Man</option>
            <option value="non-binary">Non-binary</option>
            <option value="another-gender">Another gender</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
          <span class="field-error" data-error-for="gender" aria-live="polite"></span>
        </label>

        <label class="demographic-field">
          <span class="question-text"><strong>3. What is the highest level of education you have completed?</strong></span>
          <select name="education" required>
            <option value="" selected disabled>Select one</option>
            <option value="less-than-high-school">Less than high school</option>
            <option value="high-school">High school diploma or equivalent</option>
            <option value="some-college">Some college, no degree</option>
            <option value="associate">Associate degree</option>
            <option value="bachelor">Bachelor's degree</option>
            <option value="master">Master's degree</option>
            <option value="doctoral-professional">Doctoral or professional degree</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
          <span class="field-error" data-error-for="education" aria-live="polite"></span>
        </label>

        <label class="demographic-field">
          <span class="question-text"><strong>4. Which option best describes your native language(s)?</strong></span>
          <select name="native_language" required>
            <option value="" selected disabled>Select one</option>
            <option value="english-only">English only</option>
            <option value="english-and-other">English and one or more other native languages</option>
            <option value="non-english">One or more native languages other than English</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
          <span class="field-error" data-error-for="native_language" aria-live="polite"></span>
        </label>

        <label class="demographic-field">
          <span class="question-text"><strong>5. Which country are you currently located in?</strong></span>
          <select name="country" required>
            <option value="" selected disabled>Select one</option>
            <option value="united-states">United States</option>
            <option value="canada">Canada</option>
            <option value="united-kingdom">United Kingdom</option>
            <option value="australia">Australia</option>
            <option value="new-zealand">New Zealand</option>
            <option value="another-country">Another country</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
          <span class="field-error" data-error-for="country" aria-live="polite"></span>
        </label>
      </div>
    `,
    button_label: "Submit responses",
    data: { trial_kind: "demographics" },
    on_load: () => {
      const form = document.querySelector("#jspsych-survey-html-form");
      const fields = [...form.querySelectorAll("[required]")];

      form.noValidate = true;

      const validationMessage = (field) => {
        if (field.name === "age") {
          if (field.value.trim() === "") {
            return "Please enter your age in years.";
          }

          const age = Number(field.value);
          if (!Number.isFinite(age) || age < 18 || age > 120) {
            return "Please enter an age between 18 and 120.";
          }

          return "";
        }

        return field.value === "" ? "Please select an option." : "";
      };

      const renderValidation = (field) => {
        const message = validationMessage(field);
        const error = form.querySelector(`[data-error-for="${field.name}"]`);
        error.textContent = message;
        field.toggleAttribute("aria-invalid", message !== "");
        return message === "";
      };

      for (const field of fields) {
        const eventName = field.tagName === "SELECT" ? "change" : "input";
        field.addEventListener(eventName, () => renderValidation(field));
      }

      form.addEventListener(
        "submit",
        (event) => {
          const invalidFields = fields.filter((field) => !renderValidation(field));

          if (invalidFields.length > 0) {
            event.preventDefault();
            event.stopImmediatePropagation();
            invalidFields[0].focus();
          }
        },
        true,
      );
    },
  };

  const saveData = {
    type: PipePlugin,
    action: "save",
    experiment_id: DATAPIPE_EXPERIMENT_ID,
    filename: dataFilename(submissionId),
    data_string: () => JSON.stringify(buildParticipantRecord(jsPsych.data.get().values())),
    wait_message: "<p>Saving your responses. Please do not close this page.</p>",
    data: { trial_kind: "data_save" },
    on_finish: (data) => {
      saveAccepted = isAcceptedSaveResult(data.result);
      data.save_accepted = saveAccepted;
      data.save_error = saveAccepted ? null : saveErrorCode(data.result);

      if (saveAccepted) {
        persistSession({ saveAccepted: true });
      }
    },
  };

  const saveError = {
    type: HtmlButtonResponsePlugin,
    stimulus: `
      <section class="experiment-column">
        <h1>Saving problem</h1>
        <p>Your response has not been recorded. Please check your internet connection and try again.</p>
        <p>If the problem continues, please return the study on Prolific and contact the researcher.</p>
      </section>
    `,
    choices: ["Try saving again"],
    save_trial_parameters: { stimulus: false },
    data: { trial_kind: "data_save_retry" },
  };

  const saveLoop = {
    timeline: [
      saveData,
      {
        timeline: [saveError],
        conditional_function: () => !saveAccepted,
      },
    ],
    conditional_function: () => isDataCollectionSession,
    loop_function: () => !saveAccepted,
  };

  jsPsych.run([
    consent,
    conditionAssignmentLoop,
    instructions,
    ratings,
    demographics,
    saveLoop,
  ]);
}

function validQuestionOrder(order) {
  return (
    Array.isArray(order) &&
    order.length === QUESTION_TYPES.length &&
    new Set(order).size === QUESTION_TYPES.length &&
    order.every((questionType) => QUESTION_TYPES.includes(questionType))
  );
}
