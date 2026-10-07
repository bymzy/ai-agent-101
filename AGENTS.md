# AGENTS.md

## What this repo is

Greenfield **learning project**: build an RL agent up to a StarCraft: Brood War AI ("Pluto"-style). There is **no code yet** — the only tracked artifact is `task.md`, which is the roadmap and the source of truth. Read it before planning work.

## How to work here

- Follow `task.md`'s staged plan; don't jump ahead. Priority order (from `task.md`): **Stage 2 PPO** first, then **Stage 5 self-play/league**, then **Stage 6 BWAPI/TorchCraftAI**; Stages 1/3/4 are foundations.
- Recommended first coding step: `task.md` 步骤 1.1 + 1.2 — hand-written Snake env + DQN.
- User communicates in Chinese; `task.md` is Chinese. Keep docs/comments/commit messages consistent unless asked otherwise.
- Build incrementally per stage. Do not scaffold future stages speculatively.

## Toolchain (confirmed, not inferable from repo)

- **`uv`** is the package/environment manager. Initialize with `uv init`, add deps with `uv add`, run with `uv run`.
- **CPU only**. When creating torch `device`, default to CPU and do not assume CUDA/MPS.
- Core stack: `gymnasium`, `torch`, `stable-baselines3` (+ `pettingzoo` for Stage 4+, `supersuit` if needed).
- No tests, linter, formatter, or CI exist yet. If you add them, document the exact command here.

## Environment realities for later stages

- Stages 0–4 run headless/offline (Gymnasium + PettingZoo) — easy to verify.
- Stage 6 needs external, manual installs (StarCraft 1.16.1, BWAPI 4.1.2, TorchCraftAI) that cannot be automated from this repo; treat as a separate, user-guided setup.
