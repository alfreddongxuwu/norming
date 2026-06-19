import { ParameterType } from "jspsych";

export default class TwoSliderResponsePlugin {
  static info = {
    name: "two-slider-response",
    version: "1.0.0",
    parameters: {
      stimulus: {
        type: ParameterType.HTML_STRING,
        default: undefined,
      },
      button_label: {
        type: ParameterType.STRING,
        default: "Continue",
      },
    },
    data: {
      completion_rating: { type: ParameterType.INT },
      try_rating: { type: ParameterType.INT },
      completion_rt: { type: ParameterType.INT },
      try_rt: { type: ParameterType.INT },
      question_order: { type: ParameterType.STRING, array: true },
    },
  };

  constructor(jsPsych) {
    this.jsPsych = jsPsych;
  }

  trial(displayElement, trial) {
    displayElement.innerHTML = `
      ${trial.stimulus}
      <button id="two-slider-next" class="jspsych-btn" disabled>${trial.button_label}</button>
    `;

    const inputs = [...displayElement.querySelectorAll(".rating-slider")];
    const nextButton = displayElement.querySelector("#two-slider-next");
    const moved = new Set();
    const firstMovementRt = {};
    const startTime = performance.now();

    for (const input of inputs) {
      input.addEventListener("input", () => {
        const questionType = input.dataset.questionType;
        moved.add(questionType);
        firstMovementRt[questionType] ??= Math.round(performance.now() - startTime);
        input.closest(".rating-control").classList.add("has-response");

        if (moved.size === inputs.length) {
          nextButton.disabled = false;
        }
      });
    }

    nextButton.addEventListener("click", () => {
      const values = Object.fromEntries(
        inputs.map((input) => [input.dataset.questionType, Number(input.value)]),
      );

      this.jsPsych.finishTrial({
        completion_rating: values.completion,
        try_rating: values.try,
        completion_rt: firstMovementRt.completion,
        try_rt: firstMovementRt.try,
        question_order: inputs.map((input) => input.dataset.questionType),
      });
    });
  }
}

