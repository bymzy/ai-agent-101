"""步骤 1.1：自研 10x10 贪吃蛇环境（Gymnasium 接口）。

用意是把 RL 的基本要素亲手实现一遍：
- observation 观测、action 动作、reward 奖励
- terminated 真正结束（撞墙/撞自己）、truncated 超时截断（太久没吃到食物）

观测用 11 维稀疏向量，只描述“相对当前位置”的关键信息，方便用最简单的 MLP 学习：
    0 前方是否危险   1 右方是否危险   2 左方是否危险
    3..6 当前朝向 one-hot（上/右/下/左）
    7..10 食物在四个绝对方向上的相对位置
坐标为 (row, col)，row 向下增大。
"""

from __future__ import annotations

import numpy as np

import gymnasium as gym
from gymnasium import spaces

UP, RIGHT, DOWN, LEFT = 0, 1, 2, 3

MOVES = {
    UP: (-1, 0),
    RIGHT: (0, 1),
    DOWN: (1, 0),
    LEFT: (0, -1),
}


class SnakeEnv(gym.Env):
    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 15}

    def __init__(
        self,
        grid_size: int = 10,
        step_penalty: float = -0.01,
        max_steps_without_food: int = 100,
        render_mode: str | None = None,
    ):
        super().__init__()
        self.grid_size = grid_size
        self.step_penalty = step_penalty
        self.max_steps_without_food = max_steps_without_food
        self.render_mode = render_mode

        self.observation_space = spaces.Box(0.0, 1.0, shape=(11,), dtype=np.float32)
        self.action_space = spaces.Discrete(4)

        self._rng = np.random.default_rng()
        self._fig = None
        self.body: list[tuple[int, int]] = []
        self.direction: int = RIGHT
        self.food: tuple[int, int] | None = None
        self.steps_since_food: int = 0

    def reset(self, *, seed: int | None = None, options: dict | None = None):
        super().reset(seed=seed)
        if seed is not None:
            self._rng = np.random.default_rng(seed)

        mid = self.grid_size // 2
        self.body = [(mid, mid)]
        self.direction = RIGHT
        self.steps_since_food = 0
        self._place_food()
        return self._get_obs(), {}

    def step(self, action: int):
        self.direction = int(action)
        dr, dc = MOVES[self.direction]
        head_r, head_c = self.body[0]
        new_head = (head_r + dr, head_c + dc)

        if self._is_danger(new_head):
            self.body.insert(0, new_head)
            return self._get_obs(), -1.0, True, False, {}

        self.body.insert(0, new_head)
        if new_head == self.food:
            self.steps_since_food = 0
            self._place_food()
            reward = 1.0
        else:
            self.body.pop()
            self.steps_since_food += 1
            reward = self.step_penalty

        truncated = self.steps_since_food >= self.max_steps_without_food
        return self._get_obs(), reward, False, truncated, {}

    def _get_obs(self) -> np.ndarray:
        r, c = self.body[0]
        d = self.direction
        obs = np.zeros(11, dtype=np.float32)

        straight = MOVES[d]
        right = MOVES[(d + 1) % 4]
        left = MOVES[(d - 1) % 4]
        obs[0] = self._is_danger((r + straight[0], c + straight[1]))
        obs[1] = self._is_danger((r + right[0], c + right[1]))
        obs[2] = self._is_danger((r + left[0], c + left[1]))

        obs[3 + d] = 1.0

        if self.food is not None:
            fr, fc = self.food
            obs[7] = fr < r
            obs[8] = fc > c
            obs[9] = fr > r
            obs[10] = fc < c
        return obs

    def _is_danger(self, point: tuple[int, int]) -> bool:
        return (not self._in_bounds(point)) or (point in self.body[:-1])

    def _in_bounds(self, point: tuple[int, int]) -> bool:
        r, c = point
        return 0 <= r < self.grid_size and 0 <= c < self.grid_size

    def _place_food(self) -> None:
        occupied = set(self.body)
        free = [
            (r, c)
            for r in range(self.grid_size)
            for c in range(self.grid_size)
            if (r, c) not in occupied
        ]
        self.food = free[self._rng.integers(len(free))] if free else None

    def render(self):
        if self.render_mode is None:
            return None

        cell = 32
        grid = np.full((self.grid_size, self.grid_size, 3), 245, dtype=np.uint8)
        for i, (r, c) in enumerate(self.body):
            if self._in_bounds((r, c)):
                grid[r, c] = (20, 80, 180) if i == 0 else (60, 140, 230)
        if self.food is not None:
            grid[self.food[0], self.food[1]] = (230, 60, 60)
        img = np.kron(grid, np.ones((cell, cell, 1), dtype=np.uint8))

        if self.render_mode == "rgb_array":
            return img

        import matplotlib.pyplot as plt

        if self._fig is None:
            self._fig, self._ax = plt.subplots(figsize=(4, 4))
            plt.ion()
        self._ax.clear()
        self._ax.imshow(img)
        self._ax.set_xticks([])
        self._ax.set_yticks([])
        self._fig.canvas.draw_idle()
        plt.pause(1.0 / self.metadata["render_fps"])
        return None

    def close(self) -> None:
        if self._fig is not None:
            import matplotlib.pyplot as plt

            plt.close(self._fig)
            self._fig = None
