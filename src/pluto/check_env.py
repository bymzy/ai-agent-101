"""步骤 0.1：跑通 CartPole-v1，确认环境接口安装无误。

用法：
    uv run python -m pluto.check_env
"""

from __future__ import annotations

import gymnasium as gym

from pluto.agents.random_agent import RandomAgent


def main() -> None:
    env = gym.make("CartPole-v1")
    print("观测空间:", env.observation_space)
    print("动作空间:", env.action_space)

    obs, info = env.reset(seed=0)
    print("初始观测:", obs)
    print("reset 返回的 info:", info)

    agent = RandomAgent(env.action_space.n, seed=0)
    total = 0.0
    step = 0
    done = False
    while not done:
        action = agent.select_action(obs)
        print(action)
        obs, reward, terminated, truncated, info = env.step(action)
        total += reward
        step += 1
        done = terminated or truncated
    print(f"随机策略跑了 {step} 步，回合回报 {total}")
    print("terminated 与 truncated 的区别：前者是任务真正结束，后者是达到步数上限被截断")
    env.close()


if __name__ == "__main__":
    main()
