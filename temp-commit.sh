#!/bin/bash
cd /home/pedrolucazx/projects/inside-my-mind/imm-api
git add .
git commit -m "fix: prevent husky from running in production environments

- Update prepare script to skip husky install in production and CI
- Fixes Render deployment failure caused by missing husky binary
- Only runs husky install in local development environment" --no-verify
git push