const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const { KoiiStorageClient } = require('@_koii/storage-task-sdk');
const path = require('path');
const os = require('os');
const fs = require('fs');

class Submission {
  constructor() {
    this.client = new KoiiStorageClient();
  }

  /**
   * Выполнение задачи.
   * @param {number} round - Номер раунда.
   */
  async task(round) {
    console.log(`Task started for round: ${round}`);

    const playersData = await this.getPlayerDataFromServer();

    if (!playersData || playersData.length === 0) {
      console.log('No player data available for processing.');
      return;
    }

    let playersWithChanges = 0;

    for (const playerData of playersData) {
      const isUpdated = await this.cachePlayerDataIfUpdated(playerData);

      if (isUpdated) {
        console.log('Data has changed and updated in the cache.');
        playersWithChanges++;
      }
    }

    if (playersWithChanges === 0) {
      console.log('All player data remains unchanged.');
    }
  }

  /**
   * Получение данных игроков с сервера.
   * @returns {Promise<Array>} - Данные игроков.
   */
  async getPlayerDataFromServer() {
    try {
      const response = await fetch(
        'https://reverie-field-project-7a9a67da93ff.herokuapp.com/get_player_data_for_koii',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  /**
   * Кэширование данных игрока.
   * @param {Object} playerData - Данные игрока.
   * @returns {Promise<boolean>} - Изменились ли данные.
   */
  async cachePlayerDataIfUpdated(playerData) {
    try {
      const cacheKey = `player_data_${playerData.username}`;
      const cachedData = await namespaceWrapper.storeGet(cacheKey);

      if (cachedData) {
        const cachedPlayerData = JSON.parse(cachedData);

        if (this.isPlayerDataChanged(cachedPlayerData, playerData)) {
          await namespaceWrapper.storeSet(cacheKey, JSON.stringify(playerData));
          await this.addKeyToCacheList(cacheKey);
          return true;
        }
        return false;
      } else {
        await namespaceWrapper.storeSet(cacheKey, JSON.stringify(playerData));
        await this.addKeyToCacheList(cacheKey);
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Добавление ключа в список кэша.
   * @param {string} key - Ключ.
   */
  async addKeyToCacheList(key) {
    try {
      let cacheKeys = await namespaceWrapper.storeGet('cacheKeys');
      cacheKeys = cacheKeys ? JSON.parse(cacheKeys) : [];

      if (!cacheKeys.includes(key)) {
        cacheKeys.push(key);
        await namespaceWrapper.storeSet('cacheKeys', JSON.stringify(cacheKeys));
      }
    } catch {
      // Ошибки здесь не критичны, пропускаем их
    }
  }

  /**
   * Проверка, изменились ли данные игрока.
   * @param {Object} cachedData - Закэшированные данные.
   * @param {Object} newData - Новые данные.
   * @returns {boolean} - Результат проверки.
   */
  isPlayerDataChanged(cachedData, newData) {
    return (
      cachedData.total_points !== newData.total_points ||
      cachedData.level !== newData.level ||
      JSON.stringify(cachedData.relics || []) !== JSON.stringify(newData.relics || [])
    );
  }

  /**
   * Отправка данных на сервер.
   * @param {number} round - Номер раунда.
   */
  async submitTask(round) {
    try {
      const cachedPlayersData = await this.fetchCachedPlayerData();

      if (cachedPlayersData.length === 0) {
        console.log('No data available for submission.');
        return;
      }

      const submissionData = {
        round,
        timestamp: Date.now(),
        cachedPlayersData,
      };

      const userStaking = await namespaceWrapper.getSubmitterAccount();
      const ipfsCid = await this.uploadToIPFS(submissionData, userStaking);
      console.log('Data uploaded to IPFS, CID:', ipfsCid);

      if (Buffer.byteLength(ipfsCid, 'utf8') <= 512) {
        await namespaceWrapper.checkSubmissionAndUpdateRound(ipfsCid, round);
        console.log('Submission completed with CID:', ipfsCid);
      }
    } catch {
      // Ошибки здесь не критичны, пропускаем их
    }
  }

  /**
   * Загрузка данных в IPFS.
   * @param {Array} data - Данные для загрузки.
   * @param {Object} userStaking - Информация об аккаунте.
   * @param {number} retries - Число попыток.
   * @returns {Promise<string>} - CID данных.
   */
  async uploadToIPFS(data, userStaking, retries = 3) {
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, `submission_${userStaking.publicKey}_${Date.now()}.json`);

    fs.writeFileSync(filePath, JSON.stringify(data));

    while (retries > 0) {
      try {
        const fileUploadResponse = await this.client.uploadFile(filePath, userStaking);
        return fileUploadResponse.cid;
      } catch {
        retries--;
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }
  }

  /**
   * Получение данных всех игроков из кэша.
   * @returns {Promise<Array>} - Данные игроков.
   */
  async fetchCachedPlayerData() {
    try {
      let cacheKeys = await namespaceWrapper.storeGet('cacheKeys');
      cacheKeys = cacheKeys ? JSON.parse(cacheKeys) : [];

      const playersData = [];
      for (const key of cacheKeys) {
        const playerData = await namespaceWrapper.storeGet(key);
        if (playerData) {
          playersData.push(JSON.parse(playerData));
        }
      }

      return playersData;
    } catch {
      return [];
    }
  }
}

const submission = new Submission();
module.exports = { submission };
