const { namespaceWrapper } = require('@_koii/namespace-wrapper');

class Distribution {
  async submitDistributionList(round) {
    console.log(`Отправка списка распределения для раунда ${round}`);
    try {
      const distributionList = await this.generateDistributionList(round);
      if (!Object.keys(distributionList).length) {
        return console.log('Список распределения не сгенерирован');
      }
      
      const decider = await namespaceWrapper.uploadDistributionList(distributionList, round);
      if (decider) {
        const response = await namespaceWrapper.distributionListSubmissionOnChain(round);
        console.log('Результат отправки списка распределения:', response);
      }
    } catch (error) {
      console.log('Ошибка при отправке списка распределения:', error);
    }
  }

  async generateDistributionList(round) {
    try {
      console.log(`Генерация списка распределения для раунда ${round}`);
      let distributionList = {};
      let validCandidates = [];
      let taskAccountDataJSON, taskStakeListJSON;

      try {
        taskAccountDataJSON = await namespaceWrapper.getTaskSubmissionInfo(round);
        taskStakeListJSON = await namespaceWrapper.getTaskState({ is_stake_list_required: true });
      } catch (error) {
        console.error('Ошибка при получении данных сабмишенов и стейков:', error);
        return distributionList;
      }

      const submissions = taskAccountDataJSON?.submissions[round];
      const stakeList = taskStakeListJSON?.stake_list;
      if (!submissions || !stakeList) {
        console.log(`Нет сабмишенов или стейков для раунда ${round}`);
        return distributionList;
      }

      const submissions_audit_trigger = taskAccountDataJSON?.submissions_audit_trigger?.[round] || {};

      Object.keys(submissions).forEach(candidatePublicKey => {
        const votes = submissions_audit_trigger?.[candidatePublicKey]?.votes || [];
        const validVotes = votes.reduce((acc, vote) => acc + (vote.is_valid ? 1 : -1), 0);

        if (validVotes >= 0) {
          validCandidates.push(candidatePublicKey);
        } else {
          const slashedStake = stakeList[candidatePublicKey] * 0.7;
          distributionList[candidatePublicKey] = -slashedStake;
          console.log('Ставка кандидата снижена:', candidatePublicKey, slashedStake);
        }
      });

      const rewardPerNode = Math.floor(taskStakeListJSON.bounty_amount_per_round / validCandidates.length);
      validCandidates.forEach(candidate => {
        distributionList[candidate] = rewardPerNode;
      });

      console.log('Финальный список распределения:', distributionList);
      return distributionList;
    } catch (error) {
      console.log('Ошибка при генерации списка распределения:', error);
      return {};
    }
  }

  async auditDistribution(roundNumber) {
    console.log(`Аудит списка распределения для раунда ${roundNumber}`);
    await namespaceWrapper.validateAndVoteOnDistributionList(
      this.validateDistribution.bind(this),
      roundNumber
    );
  }

  async validateDistribution(distributionListSubmitter, round) {
    try {
      const rawDistributionList = await namespaceWrapper.getDistributionList(distributionListSubmitter, round);
      if (rawDistributionList == null) {
        return true;
      }

      const fetchedDistributionList = JSON.parse(rawDistributionList);
      const generatedDistributionList = await this.generateDistributionList(round);

      return this.shallowEqual(fetchedDistributionList, generatedDistributionList);
    } catch (error) {
      console.log('Ошибка при валидации списка распределения:', error);
      return false;
    }
  }

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
