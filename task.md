# 从 Python 到 Pluto 类星际争霸 AI：强化学习项目步骤

## 阶段 0：PyTorch + Gymnasium 热身

### 步骤 0.1 安装环境
- 安装 `gymnasium`、`torch`、`stable-baselines3`
- 跑通 `CartPole-v1`

### 步骤 0.2 随机策略
- 写一个随机动作 agent
- 打印每回合回报
- 画出回报曲线

**掌握**：环境接口、观测、动作、奖励、终止、截断、Tensor、训练循环

**运行方式**：
```bash
uv sync                                          # 首次安装依赖
uv run python -m pluto.check_env                 # 步骤 0.1：跑通 CartPole-v1
uv run python -m pluto.random_baseline           # 步骤 0.2：随机策略，打印回报并画曲线
```

---

## 阶段 1：DQN —— 值函数直觉

### 步骤 1.1 自己写贪吃蛇环境
- 10x10 网格
- 状态：网格或向量
- 动作：4 个方向
- 奖励：吃食物 +1，撞墙/自己 -1，每步小负奖励

### 步骤 1.2 实现 DQN
- 经验回放
- 目标网络
- epsilon-greedy

### 步骤 1.3 训练与可视化
- 平均得分稳定上升
- 可视化 agent 玩

### 步骤 1.4 CartPole DQN 变体
- 复现 DQN
- 加 Double DQN
- 加 Dueling DQN
- 对比曲线

**掌握**：MDP、Q 值、贝尔曼方程、离策略学习、经验回放、目标网络、探索与利用、Q 值过估计

**产出**：贪吃蛇能稳定得分；CartPole 平均回报 500；三种变体对比报告

**运行方式**：
```bash
uv run python -m pluto.train_snake --episodes 1000      # 步骤 1.2/1.3：训练贪吃蛇
uv run python -m pluto.play_snake                       # 步骤 1.3：可视化 Agent 玩
uv run python -m pluto.train_cartpole --episodes 500    # 步骤 1.4：DQN/Double/Dueling 对比
```

---

## 阶段 2：A2C / PPO —— 主攻策略梯度

### 步骤 2.1 实现 A2C
- Actor 输出动作概率
- Critic 输出状态价值
- 用优势函数更新
- 训练 `CartPole-v1`

### 步骤 2.2 实现 PPO
- 加入 GAE
- 加入裁剪目标
- 加入熵正则
- 加入多环境并行
- 训练 `LunarLander-v2`

### 步骤 2.3 调参与监控
- 监控 KL
- 调裁剪系数
- 调学习率
- 对比 A2C 与 PPO

**掌握**：策略梯度、Actor-Critic、优势函数、重要性采样、PPO-Clip、GAE、熵奖励、KL 监控、并行采样

**产出**：CartPole 稳定 500；LunarLander 平均回报 200+；能解释 PPO 为什么比 A2C 稳定

---

## 阶段 3：SAC / TD3 —— 连续控制

### 步骤 3.1 实现 SAC
- 随机策略
- 重参数化
- 双 Q
- 目标熵
- 探索温度
- 训练 `Pendulum-v1`

### 步骤 3.2 实现 TD3
- 确定性策略
- 双 Q
- 延迟更新
- 目标策略平滑
- 训练 `BipedalWalker-v3`

### 步骤 3.3 对比与总结
- 对比 SAC 与 TD3
- 理解连续控制与离散控制差异

**掌握**：连续动作空间、随机策略、确定性策略、重参数化、双 Q、目标熵、延迟更新、探索温度

**产出**：Pendulum 接近 -200；BipedalWalker 达到 300+

---

## 阶段 4：多智能体 —— MAPPO / QMIX

### 步骤 4.1 选择环境
- 使用 `PettingZoo`
- 选 `simple_tag` 或 `multiwalker`

### 步骤 4.2 实现 MAPPO 或 QMIX
- 多个 agent 共享参数
- 集中训练、分散执行
- 处理部分可观测

### 步骤 4.3 评估与进阶
- 观察合作任务胜率
- 解释 CTDE
- 进阶尝试 `SMAC`

**掌握**：Dec-POMDP、部分可观测、CTDE、信用分配、参数共享、非平稳环境

**产出**：合作任务胜率明显提升；能解释“集中训练、分散执行”

---

## 阶段 5：自对弈与联盟训练 —— 接近 Pluto 的关键

### 步骤 5.1 井字棋自对弈
- 实现井字棋环境
- 用 DQN 或 PPO 自对弈
- 维护历史模型池
- 定期评估 Elo

### 步骤 5.2 Pong 自对弈
- 使用 PettingZoo 的 Pong
- 两个 agent 自对弈
- 加入对手采样
- 加入联盟训练

### 步骤 5.3 分析与迭代
- 观察自对弈曲线
- 调整对手池
- 加入主探索者/主利用者

**掌握**：自对弈、策略迭代、对手池、非平稳性、Elo 评估、联盟训练、策略多样性

**产出**：井字棋 agent 对随机策略不败；Pong 自对弈曲线持续上升，能对抗内置 AI

---

## 阶段 6：接入 BWAPI / TorchCraftAI —— 做星际争霸 AI

### 步骤 6.1 配置环境
- 安装《星际争霸：母巢之战》1.16.1
- 安装 BWAPI 4.1.2
- 安装 TorchCraftAI
- 让 Python 进程能收到游戏状态并发送指令

### 步骤 6.2 跑通小地图
- AI 能采矿
- AI 能造农民
- AI 能造兵

### 步骤 6.3 单一种族微操任务
- 只玩 Terran
- 只造机枪兵
- 训练 PPO 打简单内置 AI
- 奖励：击杀、存活、经济

### 步骤 6.4 完整对局原型
- 接入 PPO
- 接入自对弈
- 接入对手池
- 观测：实体列表 + 空间特征
- 动作头：指针网络/自回归

**掌握**：观测空间设计、动作空间设计、动作掩码、IPC、分布式推理、奖励塑形、稀疏奖励、课程学习、层次化强化学习、大规模神经网络工程、分布式训练、模型部署、推理加速

**产出**：AI 能采矿造兵；能稳定击败简单 AI；能完整打完一局，胜率超过内置 AI

---

## 建议优先级

1. 阶段 2：PPO —— 必须熟
2. 阶段 5：自对弈 + 联盟 —— Pluto 的核心
3. 阶段 6：BWAPI/TorchCraftAI 集成 —— 工程落地
4. 阶段 1、3、4 作为基础

## 最建议的第一步

先做步骤 1.1 和 1.2：自己写贪吃蛇 + DQN。
做完后你会对强化学习的基本循环、Q 值、经验回放有肌肉记忆，再上 PPO 会顺很多。
