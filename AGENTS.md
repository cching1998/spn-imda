# Repository Instructions for Coding Agents

This file describes the repository so that coding agents can work safely and consistently. It reflects what exists today — the prepared starter — not the finished application. Do not invent architecture, APIs, or commands that are not present.

## Project Overview

**Smart Parking Navigator** is a .NET 10 Aspire application that will help users find HDB car parks in Singapore with real-time availability. See [`IDEATION.md`](IDEATION.md) for the product concept and [`README.md`](README.md) for the workshop curriculum.

## Repository Structure

```text
/
├── .github/                  # CI workflows and issue templates
├── data/                     # Static datasets and API contract
│   ├── HDBCarparkInformation.csv        # Static car park records (SVY21 coordinates)
│   ├── CarparkAvailability.json         # Full availability API schema
│   ├── carpark-availability-sample.json # Representative live response
│   └── carpark-availability.http        # Sample HTTP request for the API
├── docs/                     # Workshop step-by-step guides
├── src/
│   ├── CarparkAvailability.ApiApp/      # ASP.NET Core Web API
│   ├── CarparkAvailability.AppHost/     # .NET Aspire orchestrator
│   ├── CarparkAvailability.ServiceDefaults/ # Shared observability and resilience
│   └── CarparkAvailability.WebApp/      # Blazor frontend
├── CarparkAvailability.slnx  # Solution file
├── Directory.Build.props     # Shared MSBuild properties (net10.0, nullable, implicit usings)
├── Directory.Packages.props  # Central NuGet package versions
└── global.json               # .NET SDK pin (10.0.100, latestFeature, no prereleases)
```

## Technology Stack

| Layer | Technology |
|---|---|
| SDK | .NET 10 (`net10.0`) |
| Orchestration | .NET Aspire 13.4.6 (`Aspire.AppHost.Sdk`) |
| Backend | ASP.NET Core Web API (`Microsoft.NET.Sdk.Web`) |
| Frontend | Blazor (`Microsoft.NET.Sdk.Web`) |
| Observability | OpenTelemetry (OTLP exporter, ASP.NET Core + HTTP + runtime instrumentation) |
| Resilience | `Microsoft.Extensions.Http.Resilience` |
| Service discovery | `Microsoft.Extensions.ServiceDiscovery` |
| API documentation | `Microsoft.AspNetCore.OpenApi` |

## Project Responsibilities

### `CarparkAvailability.ApiApp`

- ASP.NET Core Web API that will serve car park data to the frontend.
- Reads `Data/HDBCarparkInformation.csv` (copied from `data/` at build time).
- Fetches live availability from the data.gov.sg Carpark Availability API **server-side only**.
- References `CarparkAvailability.ServiceDefaults`.

### `CarparkAvailability.WebApp`

- Blazor frontend that will display car park locations, availability, and filters.
- Calls only `CarparkAvailability.ApiApp`; it never calls data.gov.sg directly.
- References `CarparkAvailability.ServiceDefaults`.

### `CarparkAvailability.AppHost`

- .NET Aspire AppHost that composes and launches ApiApp and WebApp together.
- References both ApiApp and WebApp.
- Stores the user-secrets ID `smart-parking-navigator-workshop-apphost`.

### `CarparkAvailability.ServiceDefaults`

- Shared library (`IsAspireSharedProject`) that configures OpenTelemetry, HTTP resilience, and service discovery.
- Referenced by both ApiApp and WebApp.

## Data and API Contract

- **HDB Car Park Information**: `data/HDBCarparkInformation.csv`. Coordinates are in the SVY21 system and must be converted to WGS84 before use on a map.
- **Carpark Availability API contract**: `data/CarparkAvailability.json` (OpenAPI specification). Treat this as the primary contract.
- **Sample response**: `data/carpark-availability-sample.json`.
- **Sample HTTP request**: `data/carpark-availability.http`.
- Join static data to live data using `car_park_no` / `carpark_number`.
- Numeric values in the live API are provided as strings; convert them safely.

## Build, Run, and Validation Commands

All commands must be run from the repository root unless otherwise noted.

### Restore dependencies

```bash
dotnet restore CarparkAvailability.slnx
```

### Build the solution

```bash
dotnet build CarparkAvailability.slnx
```

### Run the application (requires Aspire workload and API keys)

```bash
dotnet run --project src/CarparkAvailability.AppHost
```

### Run tests (once a test project exists)

```bash
dotnet test CarparkAvailability.slnx
```

Do not invent test project names or test commands that do not yet exist.

## General Guidelines

- Target `net10.0`. Do not downgrade the framework.
- Nullable reference types and implicit usings are enabled globally via `Directory.Build.props`.
- Package versions are managed centrally in `Directory.Packages.props`. Do not add `Version` attributes to individual `<PackageReference>` elements.
- Do not add projects, packages, or source files that are not required by the current task.
- Do not implement application features that are not described in the active issue.

## Security and Secrets

- **Never commit API keys, tokens, or credentials** to the repository.
- Store the data.gov.sg API key and the Google Maps API key using .NET user secrets or environment variables. See `docs/data-gov-sg-api-key.md` and `docs/google-maps-api-key.md`.
- The AppHost user-secrets ID is `smart-parking-navigator-workshop-apphost`.
- The WebApp must **never** call data.gov.sg directly from the browser. All external API calls must go through ApiApp.
- Google Maps is a browser-side library loaded in WebApp with a restricted API key; the key must never be embedded in server-side code or committed to source control.

## Testing

- Add tests only when the issue explicitly requires them or when a `PRD.md` or `TRD.md` has been agreed.
- Place test projects under `src/` following the pattern `CarparkAvailability.<Subject>.Tests`.
- Validate the live data.gov.sg response against `data/CarparkAvailability.json` with contract tests.
- Do not remove or disable existing tests.

## Documentation

- Follow the workshop guide structure under `docs/`.
- Update `AGENTS.md` when the repository structure, commands, or guardrails change.
- When a `PRD.md` or `TRD.md` is agreed, tests and inline documentation must align with those documents.

## Commit and Pull-Request Guidance

- Write commit messages in the imperative mood: `Add endpoint for carpark availability`.
- Keep each commit focused on a single logical change.
- Reference the issue number in the PR description: `Closes #<number>`.
- Do not merge a PR that breaks `dotnet build CarparkAvailability.slnx`.
- Do not commit generated files, build artifacts, or IDE-specific files that are already excluded by `.gitignore`.
