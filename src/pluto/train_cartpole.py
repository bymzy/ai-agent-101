"""步骤 1.4：在 CartPole-v1 上对比 DQN / Double DQN / Dueling DQN。

用法：
    uv run python -m pluto.train_cartpole --episodes 500
"""

from __future__ import annotations

import argparse
from pathlib import Path

import gymnasium as gym
import torch

from pluto.agents.dqn import DQNAgent
from pluto.utils import plot_returns, train_agent

VARIANTS = {
    "DQN": {},
    "Double DQN": {"double_dqn": True},
    "Dueling DQN": {"dueling": True},
}


def main() -> None:
    parser = argparse.ArgumentParser(description="CartPole DQN 变体对比")
    parser.add_argument("--episodes", type=int, default=1000)
    parser.add_argument("--hidden-dim", type=int, default=128)
    parser.add_argument("--gamma", type=float, default=0.99)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--buffer-capacity", type=int, default=100_000)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--target-update", type=int, default=400)
    parser.add_argument("--tau", type=float, default=0.005, help="Polyak 软更新系数；设为负则用硬更新")
    parser.add_argument("--epsilon-decay-steps", type=int, default=15_000)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out-dir", type=Path, default=Path("runs/cartpole"))
    parser.add_argument(
        "--variants",
        nargs="+",
        default=list(VARIANTS),
        choices=list(VARIANTS),
        help="只训练指定变体（默认全部）",
    )
    args = parser.parse_args()

    env = gym.make("CartPole-v1")
    obs_dim = env.observation_space.shape[0]
    n_actions = env.action_space.n

    all_returns: dict[str, list[float]] = {}
    for name in args.variants:
        kwargs = VARIANTS[name]
        print(f"\n===== 训练 {name} =====")
        torch.manual_seed(args.seed)
        agent = DQNAgent(
            obs_dim,
            n_actions,
            hidden_dim=args.hidden_dim,
            gamma=args.gamma,
            lr=args.lr,
            buffer_capacity=args.buffer_capacity,
            batch_size=args.batch_size,
            target_update=args.target_update,
            tau=args.tau if args.tau >= 0 else None,
            epsilon_decay_steps=args.epsilon_decay_steps,
            **kwargs,
        )
        returns = train_agent(env, agent, args.episodes, seed=args.seed)
        all_returns[name] = returns

        args.out_dir.mkdir(parents=True, exist_ok=True)
        agent.save(args.out_dir / f"{name.replace(' ', '_').lower()}.pt")

    plot_returns(
        None,
        args.out_dir / "comparison.png",
        title="CartPole: DQN vs Double DQN vs Dueling DQN",
        curves=all_returns,
    )
    print(f"\n对比曲线已保存到 {args.out_dir / 'comparison.png'}")


if __name__ == "__main__":
    main()
