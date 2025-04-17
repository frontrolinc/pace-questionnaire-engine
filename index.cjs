class QuestionnaireEngine {

  #objQuestionMapping = {};
  #objQuestionAnswerMapping = {};
  #arrLevel1QuestionsIds = [];
  #arrRiskCategoryMapping = [];
  #linkedAnswerQuestionIds = {};
  #basicInfoQuestionId = '';
  basicInfoScore = '';
  basicInfoIndicatorFlag = '';

  constructor(questionnaires, responses, context, riskCategoryMapping, riskAssessmentDetails, contextCodes) {
    this.questionnaires = questionnaires;
    this.responses = responses;
    this.context = context;
    this.riskAssessmentDetails = riskAssessmentDetails;
    this.answers = {};
    this.finalScore = 0;
    this.previousQuestionAnswerMapping = {};
    this.contextCodes = contextCodes;

    const { questionMapping, level1QuestionIds, basicInfoQuestionId } = this.#initQuestionMapping(questionnaires);
    const { questionAnswerMapping, linkedAnswerQuestionIds } = this.#initQuestionAnswerMapping(responses);
    this.#objQuestionAnswerMapping = questionAnswerMapping;
    this.#linkedAnswerQuestionIds = linkedAnswerQuestionIds;
    this.#objQuestionMapping = questionMapping;
    this.#arrLevel1QuestionsIds = level1QuestionIds;
    this.#basicInfoQuestionId = basicInfoQuestionId;
    this.#arrRiskCategoryMapping = riskCategoryMapping;
    this.#initPreviousAssessmentMapping(riskAssessmentDetails);
    // this.#initBasicInfoRiskScoreAndIndicatorFlag();
  }

  #initQuestionMapping(questionnaires) {
    let questionMapping = {}, level1QuestionIds = [], basicInfoQuestionId = '';
    questionnaires.forEach(question => {
      const { question_id, question_level, question_title } = question;
      // (question_level === 1 && question_title !== 'FNTL Contract Type') && level1QuestionIds.push(question_id);
      // if (question_level === 1 && question_title === 'FNTL Contract Type') basicInfoQuestionId = question_id;
      (question_level === 1) && level1QuestionIds.push(question_id);
      if (question_level === 1) basicInfoQuestionId = question_id;
      if (!questionMapping[question_id]) questionMapping[question_id] = {};
      questionMapping[question_id] = question;
    });
    return { questionMapping, level1QuestionIds, basicInfoQuestionId };
  }

  #initQuestionAnswerMapping(responses) {
    let questionAnswerMapping = {}, linkedAnswerQuestionIds = {};
    for (let i = 0; i < responses.length; i++) {
      responses[i].has_selected = false;
      const { question_id, answer_id, answer_scores, next_questionnaire_id } = responses[i];
      if (!this.answers[question_id]) {
        this.answers[question_id] = { answer_list: [], risk_score: 0 };
      }
      if (!questionAnswerMapping[question_id]) questionAnswerMapping[question_id] = {};
      if (!answer_scores) continue;
      questionAnswerMapping[question_id][answer_id] = responses[i];
      if (next_questionnaire_id) {
        if (!linkedAnswerQuestionIds[question_id]) linkedAnswerQuestionIds[question_id] = {};
        linkedAnswerQuestionIds[question_id][answer_id] = next_questionnaire_id;
      }
    }
    return { questionAnswerMapping, linkedAnswerQuestionIds };
  }

  #initPreviousAssessmentMapping(riskAssessmentDetails) {
    if (riskAssessmentDetails.length > 0) {
      riskAssessmentDetails.forEach(risk => {
        const { question_id, answer_ids } = risk;
        this.previousQuestionAnswerMapping[question_id] = answer_ids
        this.updateScores(question_id, answer_ids);
        answer_ids.forEach(answer_id => {
          const answer = this.#objQuestionAnswerMapping[question_id][answer_id];
          answer.has_selected = true;
        })
      });
    }
  }

  // #initBasicInfoRiskScoreAndIndicatorFlag() {
  //   let score, question_indicator_flag;
  //   if (this.#basicInfoQuestionId) {
  //     let { contract_type = '' } = this.context
  //     if (contract_type.includes('Fixed Price')) {
  //       contract_type = 'Fixed Price'
  //     } else if (contract_type.includes('T&M (with Cap)')) {
  //       contract_type = 'T&M (with Cap)'
  //     } else if (contract_type.includes('T&M')) {
  //       contract_type = 'T&M'
  //     } else if (contract_type.includes('CPFF')) {
  //       contract_type = 'CPFF'
  //     }
  //     for (const answerId in this.#objQuestionAnswerMapping[this.#basicInfoQuestionId]) {
  //       const { answer_title = '' } = this.#objQuestionAnswerMapping[this.#basicInfoQuestionId][answerId];
  //       if (contract_type === answer_title) {
  //         const { score: basicInfoScore, question_indicator_flag: basicInfoIndicatorFlag } = this.updateScores(this.#basicInfoQuestionId, [Number(answerId)]);
  //         [score, question_indicator_flag] = [basicInfoScore, basicInfoIndicatorFlag];
  //       }
  //     }

  //     if (!(score >= 0 && question_indicator_flag)) {
  //       throw new Error('Basic Details not found');
  //     };

  //     [this.basicInfoScore, this.basicInfoIndicatorFlag] = [score, question_indicator_flag];
  //     return;
  //   } else {
  //     throw new Error('FNTL Contract Type question not found');
  //   }
  // }

  getNextQuestions(currentQuestionId = null, currentAnswerId = null) {
    const level1QuestionAnswerMapping = [];
    if (currentQuestionId === null && currentAnswerId === null) {
      for (const questionId of this.#arrLevel1QuestionsIds) {
        const question = this.#objQuestionMapping[questionId];
        const answer_list = [];
        for (const answerId in this.#objQuestionAnswerMapping[questionId]) {
          answer_list.push(this.#objQuestionAnswerMapping[questionId][answerId]);
        }
        if (answer_list.length > 0) {
          const answerList = answer_list.sort((a1, a2) => (a1.display_sequence > a2.display_sequence) ? 1 : (a1.display_sequence < a2.display_sequence) ? -1 : 0);
          level1QuestionAnswerMapping.push({ ...question, answer_list: answerList });
        }
      }
      const sortedQuestions = level1QuestionAnswerMapping.sort((q1, q2) => (q1.display_sequence > q2.display_sequence) ? 1 : (q1.display_sequence < q2.display_sequence) ? -1 : 0);
      const groupedQuestionsByContext = this.getGroupedDataByContext(sortedQuestions);
      return groupedQuestionsByContext;
    }

    if (currentQuestionId !== null && currentAnswerId !== null) {
      const answer = this.#objQuestionAnswerMapping[currentQuestionId][currentAnswerId];
      // console.log("answer jere om 132", answer)

      if (!answer) {
        throw new Error('Please provide a valid answer id')
      }

      const nextQuestionId = answer['next_questionnaire_id'];

      let nextQuestion = {};
      if (nextQuestionId) {
        const question = this.#objQuestionMapping[nextQuestionId];
        const answer_list = [];
        for (const answerId in this.#objQuestionAnswerMapping[nextQuestionId]) {
          answer_list.push(this.#objQuestionAnswerMapping[nextQuestionId][answerId]);
        }
        if (answer_list.length > 0) {
          const answerList = answer_list.sort((a1, a2) => (a1.display_sequence > a2.display_sequence) ? 1 : (a1.display_sequence < a2.display_sequence) ? -1 : 0);
          nextQuestion = { ...question, answer_list: answerList };
        }
        return this.getGroupedDataByContext([nextQuestion]);
        // return nextQuestion;
      } else {
        return this.getGroupedDataByContext([nextQuestion]);
        // return nextQuestion;
      }
    }
  }

  updateScores(questionId, answerIdList) {
    const question = this.#objQuestionMapping[questionId];

    if (!question) {
      throw new Error('Please provide a valid question id')
    }

    const { score_logic = '' } = question;
    const arrAnswersScore = [], arrIndicatorFlag = [], arrTrigggerList = [], arrRiskList = [];

    const linkedQuestionAnswerIds = this.#linkedAnswerQuestionIds[questionId] || {};
    if (Object.keys(linkedQuestionAnswerIds).length > 0) {
      for (const answerId in linkedQuestionAnswerIds) {
        if (!answerIdList.includes(+answerId)) {
          const linkedQuestionId = linkedQuestionAnswerIds[answerId];
          this.answers[linkedQuestionId].answer_list.length > 0 && this.updateScores(linkedQuestionId, []);
        }
      }
    }

    answerIdList.forEach(answerId => {
      const answer = this.#objQuestionAnswerMapping[questionId][answerId];

      if (!answer) {
        throw new Error('Please provide a valid answer id')
      }

      const { answer_scores = [], indicator_flag = '', trigger_list = [], risk_list = [] } = answer;
      arrIndicatorFlag.push(indicator_flag);

      if (risk_list && risk_list.length > 0) {
        arrRiskList.push(...risk_list);
      }

      if (trigger_list && trigger_list.length > 0) {
        arrTrigggerList.push(...trigger_list);
      }

      if (answer_scores && answer_scores.length > 0) {
        const { contract_value = 0 } = this.context;

        answer_scores.forEach(answer => {
          const { threshold_amount_min = 0, threshold_amount_max = 0, score = 0 } = answer;
          if (contract_value >= threshold_amount_min && (contract_value < threshold_amount_max || threshold_amount_max == null)) {
            arrAnswersScore.push(score);
            this.#objQuestionAnswerMapping[questionId][answerId][`answer_score`] = score;
          }
        });
      }
    });

    let score;
    switch (score_logic) {
      case 'MAX':
        score = (arrAnswersScore.length > 0) ? Math.max(...arrAnswersScore) : 0;
        break;
      case 'SUM':
        score = (arrAnswersScore.length > 0) ? arrAnswersScore.reduce((accumulator, currentValue) => accumulator + currentValue, 0) : 0;
        break;
      case 'AVG':
        score = (arrAnswersScore.length > 0) ? arrAnswersScore.reduce((accumulator, currentValue) => accumulator + currentValue, 0) / arrAnswersScore.length : 0;
        break;
      case 'NONE':
        score = 0;
        break;
      default:
        score = 0;
    }

    const question_indicator_flag = arrIndicatorFlag.includes('R') === true ? 'R' : (arrIndicatorFlag.includes('Y') ? 'Y' : 'G');
    const previousScore = this.answers[questionId].risk_score;
    this.answers[questionId] = { answer_list: answerIdList, risk_score: score, question_indicator_flag, trigger_list: arrTrigggerList, risk_list: arrRiskList };
    this.finalScore = this.finalScore + score - previousScore;
    return { score, question_indicator_flag, trigger_list: arrTrigggerList, risk_list: arrRiskList };
  }


  getGroupedDataByContext(data) {
    const uniqueContextCodes = new Set();
    
    data.forEach(item => {
      uniqueContextCodes.add(item.context_code);
    });
  
    const groupedData = Array.from(uniqueContextCodes).map(context_code => {
      return {
        context_code,
        context_name: this.contextCodes.find(ctx => ctx.context_code == context_code)?.context_name || "Unknown",
        questions: data.filter(q => q.context_code == context_code)
      };
    });
  
    return groupedData;
  }



  getRiskScoreAndCategory() {
    const calculated_risk_score = this.finalScore;
    let assigned_risk_score = this.finalScore;
    const { contract_value = 0, contract_type = '' } = this.context;
    let risk_category = '', risk_category_message = '';

    if (calculated_risk_score < 50 && contract_value > 10000000) {
      assigned_risk_score = 50
      risk_category_message = 'If an opportunity/project has an estimated contract value of > $10M USD then a minimum total score of 50 will apply resulting in a C2 category.'
    }

    if ((contract_type === 'Fixed Price' && calculated_risk_score < 20) || (calculated_risk_score < 20 && contract_value > 250000 && contract_value < 10000001)) {
      assigned_risk_score = 20
      risk_category_message = 'If an opportunity/project is fixed price or has a contract value of > $250k USD it is not eligible to be a C3A'
    }

    this.#arrRiskCategoryMapping.forEach(riskCategory => {
      const { risk_score_min, risk_score_max, risk_review_category } = riskCategory;
      if (assigned_risk_score >= risk_score_min && (assigned_risk_score <= risk_score_max || risk_score_max == null)) {
        risk_category = risk_review_category;
      }
    });

    return { calculated_risk_score, assigned_risk_score, risk_category, risk_category_message };
  }


  getTriggerList() {
    const triggerMap = {};
  
    for (const question_id in this.answers) {
      const { answer_list } = this.answers[question_id];
  
      answer_list.forEach(answerId => {
        const { trigger_list = [], context_code } = this.#objQuestionAnswerMapping[question_id][answerId];
  
        if (Array.isArray(trigger_list) && trigger_list.length > 0 && context_code) {
          const code = context_code; // assuming context_code is now a string
  
          if (!triggerMap[code]) {
            triggerMap[code] = [];
          }
          triggerMap[code].push(...trigger_list.map(trigger => ({ trigger })));
        }
      });
    }
  
    const triggerlistByContext = Object.keys(triggerMap).map(context_code => ({
      context_code,
      context_name: this.contextCodes.find(ctx => ctx.context_code === context_code)?.context_name || "Unknown",
      triggerList: triggerMap[context_code]
    }));
  
    return triggerlistByContext;
  }

  
  getRiskList() {
    const riskMap = {};
  
    for (const question_id in this.answers) {
      const { answer_list } = this.answers[question_id];
  
      answer_list.forEach(answerId => {
        const { risk_list = [], context_code } = this.#objQuestionAnswerMapping[question_id][answerId];
  
        if (Array.isArray(risk_list) && risk_list.length > 0 && context_code) {
          const code = context_code; // assuming context_code is now a string
  
          if (!riskMap[code]) {
            riskMap[code] = [];
          }
          riskMap[code].push(...risk_list);
        }
      });
    }
  
    const riskListByContext = Object.keys(riskMap).map(context_code => ({
      context_code,
      context_name: this.contextCodes.find(ctx => ctx.context_code === context_code)?.context_name || "Unknown",
      riskList: [...new Set(riskMap[context_code])] // optional: remove duplicates
    }));
  
    return riskListByContext;
  }
  


  getFinalOutcome() {
    const finalOutcome = [];
    for (const question in this.answers) {
      const answers = [];
      const eachQuestion = this.#objQuestionMapping[question];
      const { answer_list, risk_score, question_indicator_flag, trigger_list, risk_list } = this.answers[question];

      for (const answerId in this.#objQuestionAnswerMapping[question]) {
        const answer = this.#objQuestionAnswerMapping[question][answerId];
        answer.has_selected = answer_list.includes(Number(answerId));
        answers.push(answer);
      }

      finalOutcome.push({ ...eachQuestion, answers, risk_score, ...this.context, question_indicator_flag, trigger_list, risk_list });
    }
    
    return this.getGroupedDataByContext(finalOutcome);
  }

  getPayload() {
    const payload = [];
    const deletedAnswers = [];

    for (const question_id in this.previousQuestionAnswerMapping) {
      const previousAnswers = this.previousQuestionAnswerMapping[question_id];
      previousAnswers.forEach(previousAnswerId => {
        const currentAnswers = this.answers[question_id].answer_list;
        if (!currentAnswers.includes(previousAnswerId)) {
          const question = this.#objQuestionMapping[question_id];
          const answer = this.#objQuestionAnswerMapping[question_id][previousAnswerId];
          const { question_code } = question;
          const { answer_code } = answer;
          deletedAnswers.push({ question_code, answer_code, "CRUD": "D" });
        }
      });
    }

    for (const question_id in this.answers) {

      const eachQuestion = this.#objQuestionMapping[question_id];
      const { question_code } = eachQuestion;
      const { answer_list, risk_score } = this.answers[question_id];

      if (answer_list.length > 0) {
        for (const answer_id of answer_list) {
          const arrRiskList = [], arrTriggerList = [];
          const answer = this.#objQuestionAnswerMapping[question_id][answer_id];
          const { answer_code, answer_score, trigger_list = [], risk_list = [] } = answer;

          if (risk_list && risk_list.length > 0) {
            risk_list.forEach(risk => {
              const { risk_id = '' } = risk;
              risk_id && arrRiskList.push({ risk_id });
            });
          }

          if (trigger_list && trigger_list.length > 0) {
            trigger_list.forEach(trigger => {
              const { trigger_id = '' } = trigger;
              trigger_id && arrTriggerList.push({ trigger_id });
            })
          }

          payload.push({ question_code, answer_code, risk_id_list: arrRiskList, trigger_id_list: arrTriggerList, risk_score: answer_score, "CRUD": "C" });
        }
      }
    }

    payload.push(...deletedAnswers);
    return payload;
  }

  getLinkedAnswerQuestionId() {
    return this.#linkedAnswerQuestionIds;
  }

}

module.exports = QuestionnaireEngine;