FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Install the Chromium browser + its OS dependencies for the browser_task tool
RUN playwright install --with-deps chromium
COPY . .
EXPOSE 8001
CMD ["python", "main.py"]
