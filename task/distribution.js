const { namespaceWrapper } = require('@_koii/namespace-wrapper');

class Distribution {
  /**
   * Генерация и отправка списка распределения для текущего раунда
   * @param {number} round - Номер текущего раунда
   * @returns {void}
   */
  submitDistributionList = async (round) => {
    console.log('Отправка списка распределения для раунда', round);
    try {
      const distributionList = await this.generateDistributionList(round);
      if (Object.keys(distributionList).length === 0) {
        console.log('Не удалось сгенерировать список распределения');
        return;
      }

      // Отправляем список распределения в блокчейн через Koii
      const decider = await namespaceWrapper.uploadDistributionList(distributionList, round);
      if (decider) {
        const response = await namespaceWrapper.distributionListSubmissionOnChain(round);
        console.log('Ответ после отправки списка распределения:', response);
      }
    } catch (err) {
      console.error('Ошибка при отправке списка распределения:', err);
    }
  };

  /**
   * Генерация списка распределения для текущего раунда
   * @param {number} round - Номер текущего раунда
   * @returns {Promise<object>} Список распределения для данного раунда
   */
  async generateDistributionList(round) {
    try {
      console.log('Генерация списка распределения для раунда', round);
      let distributionList = {};
      let validPlayers = [];

      // Получаем данные сабмишенов для текущего раунда
      let taskAccountDataJSON = await namespaceWrapper.getTaskSubmissionInfo(round);
      if (!taskAccountDataJSON) {
        console.error('Ошибка при получении данных сабмишенов');
        return distributionList;
      }

      const submissions = taskAccountDataJSON.submissions[round];
      if (!submissions) {
        console.log(`Нет сабмишенов для раунда ${round}`);
        return distributionList;
      }

      const submissionKeys = Object.keys(submissions);
      const taskStakeListJSON = await namespaceWrapper.getTaskState({ is_stake_list_required: true });
      if (!taskStakeListJSON) {
        console.error('Ошибка при получении списка стейков');
        return distributionList;
      }

      // Обработка сабмишенов и расчёт наград или штрафов
      for (const playerPublicKey of submissionKeys) {
        const playerSubmission = submissions[playerPublicKey];
        const isValidSubmission = this.checkIfSubmissionHasChanges(playerSubmission);

        if (isValidSubmission) {
          validPlayers.push(playerPublicKey);
        } else {
          // Если сабмишен недействителен, снижаем стейк игрока
          const playerStake = taskStakeListJSON.stake_list[playerPublicKey];
          const slashedStake = playerStake * 0.7;
          distributionList[playerPublicKey] = -slashedStake;
          console.log('Штраф для игрока:', playerPublicKey, slashedStake);
        }
      }

      // Распределение наград среди игроков с валидными сабмишенами
      const reward = Math.floor(taskStakeListJSON.bounty_amount_per_round / validPlayers.length);
      for (const validPlayer of validPlayers) {
        distributionList[validPlayer] = reward;
      }

      console.log('Итоговый список распределения:', distributionList);
      return distributionList;
    } catch (err) {
      console.error('Ошибка при генерации списка распределения:', err);
      return {};
    }
  }

  /**
   * Проверка, содержит ли сабмишен какие-либо изменения данных об игроках
   * @param {object} submission - Сабмишен игрока
   * @returns {boolean} Результат проверки на наличие изменений
   */
  checkIfSubmissionHasChanges(submission) {
    // Упрощенная проверка: если в сабмишене есть любые данные, считаем, что он валиден
    return submission && Object.keys(submission).length > 0;
  }

  /**
   * Аудит списка распределения для текущего раунда
   * @param {number} roundNumber - Номер текущего раунда
   * @returns {void}
   */
  async auditDistribution(roundNumber) {
    console.log('Аудит списка распределения для раунда:', roundNumber);
    await namespaceWrapper.validateAndVoteOnDistributionList(this.validateDistribution, roundNumber);
  }

  /**
   * Валидация списка распределения, присланного другим узлом
   * @param {string} distributionListSubmitter - Публичный ключ отправителя списка распределения
   * @param {number} round - Номер раунда
   * @returns {Promise<boolean>} Результат валидации (true, если список корректен)
   */
  validateDistribution = async (distributionListSubmitter, round) => {
    try {
      const rawDistributionList = await namespaceWrapper.getDistributionList(distributionListSubmitter, round);
      if (!rawDistributionList) {
        console.log(`Список распределения не найден для раунда ${round}`);
        return true;
      }

      const fetchedDistributionList = JSON.parse(rawDistributionList);
      const generatedDistributionList = await this.generateDistributionList(round);

      // Сравниваем списки распределения
      const isValid = this.shallowEqual(fetchedDistributionList, generatedDistributionList);
      if (isValid) {
        console.log('Список распределения успешно прошел валидацию.');
      } else {
        console.error('Ошибка: список распределения не прошел проверку.');
      }
      return isValid;
    } catch (error) {
      console.error('Ошибка при валидации списка распределения:', error);
      return false;
    }
  };

  /**
   * Сравнение двух объектов на равенство
   * @param {object} obj1 - Первый объект
   * @param {object} obj2 - Второй объект
   * @returns {boolean} Результат сравнения
   */
  shallowEqual(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) {
      return false;
    }
    for (let key of keys1) {
      if (obj1[key] !== obj2[key]) {
        return false;
      }
    }
    return true;
  }
}

const distribution = new Distribution();
module.exports = { distribution };
