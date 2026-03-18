import { apiClient } from './apiClient';
import type { ApiResponse, RuntimeOrchestration, RuntimeProgressSnapshot } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const runtimeService = {
  async getProgress(): Promise<ApiResponse<RuntimeProgressSnapshot>> {
    const response = await apiClient.get<ApiResponse<RuntimeProgressSnapshot>>(
      '/runtime/progress',
    );
    return response.data;
  },

  async getControl(): Promise<ApiResponse<RuntimeOrchestration>> {
    const response = await apiClient.get<ApiResponse<RuntimeOrchestration>>(
      '/runtime/control',
    );
    return response.data;
  },

  async updateControl(payload: {
    controller?: Partial<RuntimeOrchestration['controller']>;
    guardrails?: Partial<RuntimeOrchestration['guardrails']>;
  }): Promise<ApiResponse<RuntimeOrchestration>> {
    const response = await apiClient.patch<ApiResponse<RuntimeOrchestration>>(
      '/runtime/control',
      payload,
    );
    return response.data;
  },

  async queueCommand(payload: {
    label: string;
    action: string;
    scope?: string;
    target?: string;
    requestedBy?: string;
    value?: unknown;
  }): Promise<ApiResponse<RuntimeOrchestration>> {
    const response = await apiClient.post<ApiResponse<RuntimeOrchestration>>(
      '/runtime/commands',
      payload,
    );
    return response.data;
  },

  streamProgress(
    onMessage: (snapshot: RuntimeProgressSnapshot) => void,
    onError?: () => void,
  ) {
    const source = new EventSource(`${BASE_URL}/runtime/stream`);

    source.addEventListener('progress', (event) => {
      const messageEvent = event as MessageEvent<string>;
      onMessage(JSON.parse(messageEvent.data) as RuntimeProgressSnapshot);
    });

    source.onerror = () => {
      source.close();
      if (onError) {
        onError();
      }
    };

    return () => {
      source.close();
    };
  },
};
