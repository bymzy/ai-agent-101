"""步骤 1.2：经验回放缓冲区。

把交互产生的 (s, a, r, s', done) 存进一个环形数组，训练时随机采样。
随机采样可以打破样本之间的时间相关性，让 DQN 更接近“独立同分布”的假设。
"""

from __future__ import annotations

import numpy as np
import torch


class ReplayBuffer:
    def __init__(self, capacity: int, obs_dim: int, device: torch.device):
        self.capacity = capacity
        self.device = device
        self.states = np.zeros((capacity, obs_dim), dtype=np.float32)
        self.next_states = np.zeros((capacity, obs_dim), dtype=np.float32)
        self.actions = np.zeros(capacity, dtype=np.int64)
        self.rewards = np.zeros(capacity, dtype=np.float32)
        self.dones = np.zeros(capacity, dtype=np.float32)
        self.ptr = 0
        self.size = 0

    def push(self, state, action, reward, next_state, done) -> None:
        self.states[self.ptr] = state
        self.next_states[self.ptr] = next_state
        self.actions[self.ptr] = action
        self.rewards[self.ptr] = reward
        self.dones[self.ptr] = float(done)
        self.ptr = (self.ptr + 1) % self.capacity
        self.size = min(self.size + 1, self.capacity)

    def sample(self, batch_size: int):
        idx = np.random.randint(0, self.size, size=batch_size)
        to_tensor = lambda a, dtype: torch.as_tensor(a, dtype=dtype, device=self.device)
        return (
            to_tensor(self.states[idx], torch.float32),
            to_tensor(self.actions[idx], torch.int64),
            to_tensor(self.rewards[idx], torch.float32),
            to_tensor(self.next_states[idx], torch.float32),
            to_tensor(self.dones[idx], torch.float32),
        )

    def __len__(self) -> int:
        return self.size
