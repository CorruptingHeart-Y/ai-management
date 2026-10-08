'use strict';

const SERVICE_STATUS_LABELS = {
  checking: '正在检查服务...',
  connected: '服务连接正常',
  error: '服务连接异常',
};

/** 只接受 GET /api/members 约定的成员数组响应。 */
function isValidMembersResponse(members) {
  if (!Array.isArray(members)) return false;

  const ids = new Set();
  return members.every((member) => {
    if (!member || !Number.isSafeInteger(member.id) || member.id <= 0 ||
        typeof member.name !== 'string' || !member.name.trim() ||
        typeof member.role !== 'string' || !member.role.trim() ||
        ids.has(member.id)) {
      return false;
    }

    ids.add(member.id);
    return true;
  });
}

/**
 * 将已有成员列表请求作为连接探测，避免额外发起重复请求。
 * 状态只反映该接口，不代表所有业务功能均健康。
 */
function createServiceStatus(statusContainer, statusText, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
} = {}) {
  function setStatus(state) {
    statusContainer.dataset.state = state;
    statusText.textContent = SERVICE_STATUS_LABELS[state];
  }

  setStatus('checking');

  return {
    async check() {
      setStatus('checking');
      const controller = new AbortController();
      let timeoutId;

      const timeout = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error('服务检查超时'));
        }, timeoutMs);
      });

      const request = (async () => {
        const response = await fetchImpl('/api/members', { signal: controller.signal });
        const contentType = response.headers?.get('content-type') || '';
        if (!response.ok) {
          const error = /application\/json/i.test(contentType)
            ? await response.json().catch(() => ({}))
            : {};
          throw new Error(error.error || '成员加载失败，请稍后重试');
        }

        if (!/application\/json/i.test(contentType)) {
          throw new Error('成员接口响应格式异常');
        }

        const members = await response.json();
        if (!isValidMembersResponse(members)) {
          throw new Error('成员接口数据格式异常');
        }
        return members;
      })();

      try {
        const members = await Promise.race([request, timeout]);
        setStatus('connected');
        return members;
      } catch (error) {
        setStatus('error');
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createServiceStatus, isValidMembersResponse };
}
