"""步骤 0.2：随机策略 Agent —— 学习 RL 之前的最小 baseline。"""

from __future__ import annotations

import numpy as np


class RandomAgent:
    def __init__(self, n_actions: int, seed: int | None = None):
        self.n_actions = n_actions
        self._rng = np.random.default_rng(seed)

    def select_action(self, state) -> int:
        return int(self._rng.integers(self.n_actions))
