# Deploy Auria

Auria is a **batch tool in a container** — not a long-running server. "Deploying" it
means: publish the image once, then run it as a **job** wherever you need audits, with
the artifacts written to a mounted volume or synced to object storage. The container is
the same one proven in CI and locally (see [docker.md](docker.md)); a SaaS worker (PLAN
§7) is just this image behind a queue.

> `--nvda` (real screen reader) is Windows-only and **not** available in a container —
> route those jobs to a Windows host. Everything else, including the narrated video,
> runs headless in Linux.

## 1. Publish the image (GHCR)

The [`publish` workflow](../../.github/workflows/publish.yml) builds and pushes the image
to GitHub Container Registry on a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0        # -> ghcr.io/<owner>/auria:0.1.0  and  :latest
```

Pull it anywhere:

```bash
docker pull ghcr.io/<owner>/auria:latest
```

The package is **private** by default — make it public in the repo's **Packages**
settings for unauthenticated pulls, or `docker login ghcr.io` on the host.

## 2. Run it

### Self-hosted VM / on-prem (fits the gov "self-hosted" model)

A cron job that audits a site nightly and keeps artifacts on disk (or syncs to storage):

```bash
# /etc/cron.d/auria  — 2am daily
0 2 * * *  auditor  docker run --rm -v /srv/audits:/out \
  ghcr.io/<owner>/auria:latest https://portal.example.com/ --crawl --out /out
```

To ship artifacts off-box, add an `rclone`/`aws s3 sync /srv/audits s3://…` after the run.

### Google Cloud Run Job (serverless, per-run billing)

```bash
gcloud run jobs create auria \
  --image ghcr.io/<owner>/auria:latest \
  --args="https://example.com/,--crawl,--out,/tmp/out" \
  --memory 2Gi --cpu 2 --task-timeout 1800
gcloud run jobs execute auria
```

Mount a bucket (Cloud Run volume mounts / GCS FUSE) or add a final `gsutil rsync` so the
`.mp4`/PDF/JSON land in GCS.

### AWS ECS Fargate task

Register a task definition using `ghcr.io/<owner>/auria:latest`, `command` =
`["https://example.com/","--out","/out"]`, ~2 vCPU / 4 GB, and either a mounted EFS
volume at `/out` or an entrypoint wrapper that `aws s3 cp`s the output to S3. Trigger on a
schedule with EventBridge.

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata: { name: auria-nightly }
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: auria
              image: ghcr.io/<owner>/auria:latest
              args: ["https://example.com/", "--crawl", "--out", "/out"]
              resources: { requests: { cpu: "1", memory: "2Gi" } }
              volumeMounts: [{ name: out, mountPath: /out }]
          volumes:
            - name: out
              persistentVolumeClaim: { claimName: auria-out }
```

## 3. Sizing & tips

- **Memory:** give it ~2 GB (Chromium + video encode). CPU 1–2 vCPU.
- **Video is the slow part** (per-viewport scroll + encode). For fast, cheap CI-style
  gating use `--no-video --sarif --junit` and skip the render.
- **Neural narration:** bake a Piper voice into a derived image or mount one and set
  `PIPER_VOICE` (see [narrated-video.md](narrated-video.md#installing-piper-neural)).
- **Exit codes** propagate: `0` ok, `1` all-failed, `2` `--fail-on` breach — usable as a
  pipeline gate.
- **Artifacts → object storage** is the SaaS pattern: write to `/out`, then sync to
  S3/GCS; a queue + this image is the worker fleet from PLAN §7.
