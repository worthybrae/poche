FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Install uv for faster package management
RUN pip install uv

# Copy all files first (needed for hatchling to find the package)
COPY . .

# Install dependencies
RUN uv pip install --system -e .

# Install Playwright and browsers
RUN playwright install chromium
RUN playwright install-deps chromium

# Create screenshot directory
RUN mkdir -p /tmp/screenshots

# Expose port
EXPOSE 8080

# Run the MCP server
CMD ["python", "-m", "src.server"]
