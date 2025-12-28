FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /tests

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy test files
COPY . .

# Run tests
CMD ["pytest", "-v", "--html=/results/report.html", "--self-contained-html"]
