"""步骤 0.2：随机策略跑 CartPole，打印每回合回报并画回报曲线。

用法：
    uv run python -m pluto.random_baseline --episodes 200
"""

from __future__ import annotations

import argparse
from pathlib import Path

import gymnasium as gym

from pluto.agents.random_agent import RandomAgent
from pluto.utils import plot_returns


def main() -> None:
    parser = argparse.ArgumentParser(description="随机策略 baseline")
    parser.add_argument("--env", default="CartPole-v1")
    parser.add_argument("--episodes", type=int, default=200)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out-dir", type=Path, default=Path("runs/random"))
    args = parser.parse_args()

    env = gym.make(args.env)
    agent = RandomAgent(env.action_space.n, seed=args.seed)

    returns: list[float] = []
    for ep in range(args.episodes):
        obs, _ = env.reset(seed=args.seed + ep)
        total = 0.0
        done = False
        while not done:
            obs, reward, terminated, truncated, _ = env.step(agent.select_action(obs))
            total += reward
            done = terminated or truncated
        returns.append(total)
        print(f"回合 {ep + 1:4d} 回报 {total:6.1f}")
    env.close()

    avg = sum(returns) / len(returns)
    print(f"\n{args.episodes} 回合平均回报：{avg:.2f}")
    plot_returns(returns, args.out_dir / "returns.png", title=f"{args.env} 随机策略", window=20)
    print(f"回报曲线已保存到 {args.out_dir / 'returns.png'}")


if __name__ == "__main__":
    main()
