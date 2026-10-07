"""步骤 1.3：用 DQN 训练贪吃蛇，保存回报曲线和模型。

用法：
    uv run python -m pluto.train_snake --episodes 1000
"""

from __future__ import annotations

import argparse
from pathlib import Path

import torch

from pluto.agents.dqn import DQNAgent
from pluto.envs.snake import SnakeEnv
from pluto.utils import plot_returns, train_agent


def main() -> None:
    parser = argparse.ArgumentParser(description="DQN 训练贪吃蛇")
    parser.add_argument("--episodes", type=int, default=1000)
    parser.add_argument("--grid-size", type=int, default=10)
    parser.add_argument("--hidden-dim", type=int, default=256)
    parser.add_argument("--gamma", type=float, default=0.9)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out-dir", type=Path, default=Path("runs/snake"))
    parser.add_argument("--double-dqn", action="store_true", help="启用 Double DQN")
    parser.add_argument("--dueling", action="store_true", help="启用 Dueling DQN")
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    env = SnakeEnv(grid_size=args.grid_size)
    agent = DQNAgent(
        obs_dim=env.observation_space.shape[0],
        n_actions=env.action_space.n,
        hidden_dim=args.hidden_dim,
        gamma=args.gamma,
        lr=args.lr,
        double_dqn=args.double_dqn,
        dueling=args.dueling,
    )

    returns = train_agent(env, agent, args.episodes, seed=args.seed)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    agent.save(args.out_dir / "dqn_snake.pt")
    title = "Snake DQN"
    if args.double_dqn:
        title += " + Double"
    if args.dueling:
        title += " + Dueling"
    plot_returns(returns, args.out_dir / "returns.png", title=title)
    print(f"最近 100 回合平均回报：{sum(returns[-100:]) / len(returns[-100:]):.3f}")
    print(f"曲线与模型已保存到 {args.out_dir}/")


if __name__ == "__main__":
    main()
