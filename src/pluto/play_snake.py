"""步骤 1.3：加载训练好的模型，可视化 Agent 玩贪吃蛇。

用法：
    uv run python -m pluto.play_snake --model runs/snake/dqn_snake.pt
"""

from __future__ import annotations

import argparse
from pathlib import Path

from pluto.agents.dqn import DQNAgent
from pluto.envs.snake import SnakeEnv


def main() -> None:
    parser = argparse.ArgumentParser(description="可视化 DQN 玩贪吃蛇")
    parser.add_argument("--model", type=Path, default=Path("runs/snake/dqn_snake.pt"))
    parser.add_argument("--grid-size", type=int, default=10)
    parser.add_argument("--episodes", type=int, default=3)
    args = parser.parse_args()

    env = SnakeEnv(grid_size=args.grid_size, render_mode="human")
    agent = DQNAgent.load(args.model)

    for ep in range(args.episodes):
        state, _ = env.reset(seed=ep)
        done = False
        total = 0.0
        while not done:
            action = agent.select_action(state, greedy=True)
            state, reward, terminated, truncated, _ = env.step(action)
            total += reward
            done = terminated or truncated
            env.render()
        print(f"回合 {ep + 1}: 回报 {total:.2f}")

    env.close()


if __name__ == "__main__":
    main()
