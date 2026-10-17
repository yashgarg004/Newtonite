# Operations Under Pressure

An internal operations tool for managing work items, claims, approvals, comments, and activity history. Built to remain correct under pressure: concurrent claims, double-submitted requests, unauthorized actions, and failed background jobs.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (required only if you want to run tests locally on the host)

## Quick Start

1. Clone the repository.
2. Copy the environment template:
   ```bash
   cp .env.example .env