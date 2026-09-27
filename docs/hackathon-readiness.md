# Hackathon readiness — September 27, 2026

This is an evidence checklist, not a guarantee of judging eligibility. Recheck deployment evidence after releasing.

## Official requirements

Sources: [event rules](https://luma.com/zhkhsnpa), [publishing instructions](https://aiworthusing.com/agent-index/publish), and [official CLI](https://github.com/plow-pbc/plow-agents).

| Requirement | Evidence / remaining action |
| --- | --- |
| OpenClaw 2.0 with multiplayer | Dockerfile uses the pinned Plow OpenClaw base. Its configuration separates direct conversations (`per-account-channel-peer`) and groups (`per-group`). `withRo` preserves those settings. Test the final release with two people and a group; configuration alone does not prove live behavior. |
| Real startup role | Website QA: actual Chromium captures, measured findings, reports, repair prompts, and rechecks. |
| Public MIT project | Public `Malchiior/sitemaxxing` repository, MIT LICENSE, matching image metadata. |
| Submitted, verified, deployable | Public Plow/Index lookup on September 27 confirms admitted image, verification, one-click deployment, `openclaw` category. |
| Usage reporting | Dockerfile downloads the pinned official client; `boot/ro-main.ts` starts and supervises the reporter. Live listing showed 16 successful installs of 17 attempts at audit time. |
| Demo at least 60 seconds | Listing points to `aKSfFTccFu8`; prior local duration check recorded 63.018 seconds. |
| Genuine usage | Do not generate artificial installs or messages to raise ranking. A verification call can check actual customer value. |
| Personal eligibility | User must confirm registration, age 18+, team no larger than four, and October 6 SF availability or the permitted recorded-segment alternative. These cannot be inferred from source code. |

Submission deadline: September 28, 11:59 p.m. Pacific. Leaderboard snapshot: September 30, 11:59 p.m. Pacific. The top five advance to judging; first place on the leaderboard does not itself establish the final winner.

## Pre-release evidence

- Public image before this release: `ghcr.io/malchiior/sitemaxxing@sha256:c8675a424195cf1c45b1b6604108628c0bb25e336157131d65bf8538549d1c07` (September 24 promotion).
- Latest completed main CI at audit time: commit `4422694`, successful run `36297015645` (tests, image build, offline Chromium/gateway probe).
- Existing Sitemaxxing deployments were running on `ln_p5`, `ln_p2`, and `ln_p3`. Other account agents must not be replaced.
- No `PAGESPEED_API_KEY` in the auditing process environment or project env files. Public unauthenticated quota previously failed. Treat unavailable checks as unavailable, never as passing.
- The publishing checkout initially lacked `.env.report`. Recovered it from the exact published image above on September 27, verifying only that `REPORT_URL` and `REPORT_KEY` exist and the file is gitignored. The temporary recovery container was removed. This preserves existing hosted-report behavior; never commit or print its values, and never add account or PageSpeed API credentials to the public image.

## Release procedure

Run from the repository root. Substitute a new release tag for `RELEASE_TAG`.

```powershell
node --test tests/*.test.ts tests/*.test.mjs
python dev/plow-agents-win.py image build ghcr.io/malchiior/sitemaxxing:RELEASE_TAG
docker run --rm --network none ghcr.io/malchiior/sitemaxxing:RELEASE_TAG /opt/plow/ro-probe
python dev/plow-agents-win.py image push ghcr.io/malchiior/sitemaxxing:RELEASE_TAG --promote sitemaxxing
python dev/plow-agents-win.py image show sitemaxxing
```

Require successful exit status and `RO_PROBE_OK` before pushing. `image push` does not build. Build the reviewed working tree; preserve existing unrelated changes and avoid committing generated videos/voice media inadvertently. Capture the resulting digest and exact test results in the release record.

Rollback the new-install pin if needed:

```powershell
python dev/plow-agents-win.py image promote sitemaxxing ghcr.io/malchiior/sitemaxxing@sha256:c8675a424195cf1c45b1b6604108628c0bb25e336157131d65bf8538549d1c07
```

## Existing users and live acceptance

The official CLI README explicitly says promotion affects new agents and running agents keep their images. Do not describe a pin update as an upgrade of all current users. The CLI has no documented in-place upgrade command. `deploy` creates/requests an agent; `revoke` retires one. A persistence-preserving upgrade path must be established through Plow before replacing an occupied line.

After the new release is running, use real participating testers:

1. Person A requests one website in one direct conversation; person B requests a different website in another.
2. Each follows up with `status`, `fix`, and `pages`; responses must refer only to that conversation's report.
3. In a shared group, one person starts a report and another follows up; both use the group's shared report, independent of their direct conversations.
4. Recheck a site after a known change and confirm measured fixed/still/new results and before/after evidence.
5. Confirm report links, attachments, unavailable-performance wording, and usage reporting on the released image.

Automated isolation tests are necessary but do not substitute for this live multiplayer acceptance test. Do not fabricate the user confirmations or real-user test results.
