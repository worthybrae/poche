FROM python:3.12-slim

WORKDIR /app

# Install uv for faster package management
RUN pip install uv

# Copy all files first (needed for hatchling to find the package)
COPY . .

# Install dependencies
RUN uv pip install --system -e ".[dev]"

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
