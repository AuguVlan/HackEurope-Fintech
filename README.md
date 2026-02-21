# HackEurope-Fintech

A fintech solution developed for HackEurope using FastAPI.

## Project Structure

```
HackEurope-Fintech/
├── src/                    # Source code
│   ├── __init__.py
│   └── main.py            # FastAPI application
├── tests/                 # Unit tests
├── data/                  # Data files
├── venv/                  # Virtual environment (git ignored)
├── requirements.txt       # Project dependencies
├── README.md             # This file
└── .gitignore           # Git ignore rules
```

## Setup Instructions

### 1. Create and Activate Virtual Environment
```bash
python -m venv venv
.\venv\Scripts\activate  # On Windows
# or
source venv/bin/activate  # On macOS/Linux
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
python -m uvicorn src.main:app --reload
```

The API will be available at `http://localhost:8000`

### API Documentation
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Dependencies

- **FastAPI** - Modern web framework for building APIs
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation using Python type annotations

See `requirements.txt` for full list of dependencies.

## Development

### Running Tests
```bash
pytest tests/
```

### Code Formatting
```bash
black src/ tests/
```

### Linting
```bash
flake8 src/ tests/
```