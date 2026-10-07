"""训练辅助：通用训练循环、移动平均、回报曲线绘制。"""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from matplotlib import font_manager


def _configure_matplotlib() -> None:
    """让图中的中文标签正常显示（macOS 常见中文字体）。"""
    for name in ["PingFang SC", "Arial Unicode MS", "Heiti SC", "STHeiti", "Songti SC"]:
        try:
            font_manager.findfont(name, fallback_to_default=False)
            plt.rcParams["font.sans-serif"] = [name]
            break
        except Exception:
            continue
    plt.rcParams["axes.unicode_minus"] = False


_configure_matplotlib()


def moving_average(values, window: int = 100) -> np.ndarray:
    values = np.asarray(values, dtype=float)
    if len(values) == 0:
        return values
    window = min(window, len(values))
    return np.convolve(values, np.ones(window) / window, mode="valid")


def plot_returns(returns, path, title: str = "", window: int = 100, curves: dict | None = None) -> None:
    """画回报曲线。curves 不为空时，把多个变体画在同一张图上做对比。"""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    plt.figure(figsize=(10, 5))

    if curves:
        for label, values in curves.items():
            plt.plot(values, alpha=0.15)
            ma = moving_average(values, window)
            if len(ma):
                plt.plot(
                    np.arange(len(values) - len(ma), len(values)),
                    ma,
                    label=f"{label}（{window} 回合平均）",
                )
    else:
        plt.plot(returns, alpha=0.3, label="每回合回报")
        ma = moving_average(returns, window)
        if len(ma):
            plt.plot(
                np.arange(len(returns) - len(ma), len(returns)),
                ma,
                label=f"{window} 回合平均",
            )

    plt.xlabel("回合")
    plt.ylabel("回报")
    plt.title(title)
    plt.legend()
    plt.tight_layout()
    plt.savefig(path, dpi=120)
    plt.close()


def train_agent(env, agent, episodes: int, seed: int = 0, log_every: int = 50) -> list[float]:
    """通用训练循环：采样 -> 存回放 -> 优化，重复 episodes 个回合。"""
    returns: list[float] = []
    for ep in range(episodes):
        state, _ = env.reset(seed=seed + ep)
        total = 0.0
        done = False
        while not done:
            action = agent.select_action(state)
            next_state, reward, terminated, truncated, _ = env.step(action)
            agent.buffer.push(state, action, reward, next_state, terminated)
            agent.optimize()
            total += reward
            state = next_state
            done = terminated or truncated
        returns.append(total)
        if log_every and (ep + 1) % log_every == 0:
            avg = float(np.mean(returns[-log_every:]))
            print(
                f"回合 {ep + 1:5d} | 最近 {log_every} 平均回报 {avg:8.3f} "
                f"| epsilon {agent.epsilon():.3f}"
            )
    return returns
