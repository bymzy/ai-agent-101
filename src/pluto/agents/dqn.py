"""步骤 1.2 / 1.4：DQN 及其变体。

一个网络 + 经验回放 + 目标网络 + epsilon-greedy 就构成了基础 DQN。
通过开关复用同一套代码实现两个改进：
- double_dqn=True：Double DQN。用在线网络选动作、目标网络估值，缓解 Q 值过估计。
- dueling=True：Dueling DQN。把 Q 拆成状态价值 V 与优势 A，Q = V + (A - mean(A))。
"""

from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn

from pluto.agents.replay_buffer import ReplayBuffer


class QNetwork(nn.Module):
    def __init__(self, obs_dim: int, n_actions: int, hidden_dim: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(obs_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, n_actions),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class DuelingQNetwork(nn.Module):
    def __init__(self, obs_dim: int, n_actions: int, hidden_dim: int = 256):
        super().__init__()
        self.feature = nn.Sequential(nn.Linear(obs_dim, hidden_dim), nn.ReLU())
        self.value = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1),
        )
        self.advantage = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, n_actions),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.feature(x)
        value = self.value(feat)
        advantage = self.advantage(feat)
        return value + advantage - advantage.mean(dim=1, keepdim=True)


class DQNAgent:
    def __init__(
        self,
        obs_dim: int,
        n_actions: int,
        *,
        hidden_dim: int = 256,
        lr: float = 1e-3,
        gamma: float = 0.99,
        buffer_capacity: int = 100_000,
        batch_size: int = 64,
        target_update: int = 500,
        tau: float | None = None,
        epsilon_start: float = 1.0,
        epsilon_end: float = 0.01,
        epsilon_decay_steps: int = 20_000,
        double_dqn: bool = False,
        dueling: bool = False,
        device: torch.device | str = "cpu",
    ):
        self.obs_dim = obs_dim
        self.n_actions = n_actions
        self.hidden_dim = hidden_dim
        self.gamma = gamma
        self.batch_size = batch_size
        self.target_update = target_update
        self.tau = tau
        self.epsilon_start = epsilon_start
        self.epsilon_end = epsilon_end
        self.epsilon_decay_steps = epsilon_decay_steps
        self.double_dqn = double_dqn
        self.dueling = dueling
        self.device = torch.device(device)

        net_cls = DuelingQNetwork if dueling else QNetwork
        self.policy_net = net_cls(obs_dim, n_actions, hidden_dim).to(self.device)
        self.target_net = net_cls(obs_dim, n_actions, hidden_dim).to(self.device)
        self.target_net.load_state_dict(self.policy_net.state_dict())
        self.target_net.eval()

        self.optimizer = torch.optim.Adam(self.policy_net.parameters(), lr=lr)
        self.buffer = ReplayBuffer(buffer_capacity, obs_dim, self.device)

        self.steps_done = 0
        self.updates = 0

    def epsilon(self) -> float:
        frac = min(1.0, self.steps_done / self.epsilon_decay_steps)
        return self.epsilon_start + frac * (self.epsilon_end - self.epsilon_start)

    @torch.no_grad()
    def select_action(self, state, greedy: bool = False) -> int:
        self.steps_done += 1
        if not greedy and np.random.rand() < self.epsilon():
            return int(np.random.randint(self.n_actions))
        x = torch.as_tensor(state, dtype=torch.float32, device=self.device).unsqueeze(0)
        return int(self.policy_net(x).argmax(dim=1).item())

    def optimize(self) -> float | None:
        if len(self.buffer) < self.batch_size:
            return None
        states, actions, rewards, next_states, dones = self.buffer.sample(self.batch_size)

        q_values = self.policy_net(states).gather(1, actions.unsqueeze(1)).squeeze(1)
        with torch.no_grad():
            if self.double_dqn:
                next_actions = self.policy_net(next_states).argmax(dim=1, keepdim=True)
                next_q = self.target_net(next_states).gather(1, next_actions).squeeze(1)
            else:
                next_q = self.target_net(next_states).max(dim=1).values
            target = rewards + self.gamma * next_q * (1.0 - dones)

        loss = nn.functional.smooth_l1_loss(q_values, target)
        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.policy_net.parameters(), 10.0)
        self.optimizer.step()

        self.updates += 1
        if self.tau is None:
            if self.updates % self.target_update == 0:
                self.target_net.load_state_dict(self.policy_net.state_dict())
        else:
            # Polyak 软更新：目标网络每步向在线网络靠近一小步，比硬拷贝稳定
            with torch.no_grad():
                for target_param, param in zip(
                    self.target_net.parameters(), self.policy_net.parameters()
                ):
                    target_param.mul_(1.0 - self.tau).add_(self.tau * param)
        return float(loss.item())

    def save(self, path) -> None:
        torch.save(
            {
                "obs_dim": self.obs_dim,
                "n_actions": self.n_actions,
                "hidden_dim": self.hidden_dim,
                "double_dqn": self.double_dqn,
                "dueling": self.dueling,
                "policy": self.policy_net.state_dict(),
            },
            path,
        )

    @classmethod
    def load(cls, path, device: torch.device | str = "cpu") -> "DQNAgent":
        ckpt = torch.load(path, map_location=device)
        agent = cls(
            ckpt["obs_dim"],
            ckpt["n_actions"],
            hidden_dim=ckpt["hidden_dim"],
            double_dqn=ckpt["double_dqn"],
            dueling=ckpt["dueling"],
            device=device,
        )
        agent.policy_net.load_state_dict(ckpt["policy"])
        agent.target_net.load_state_dict(ckpt["policy"])
        return agent
