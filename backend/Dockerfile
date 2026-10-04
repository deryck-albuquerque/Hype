FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend/app

WORKDIR /app

COPY backend/requirements.txt /tmp/requirements.txt

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /tmp/requirements.txt


FROM base AS runtime

COPY backend/app /app/backend/app

RUN groupadd --system app \
    && useradd --system --gid app --create-home app \
    && chown -R app:app /app/backend/app

USER app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


FROM base AS test

COPY backend/requirements-dev.txt /tmp/requirements-dev.txt

RUN pip install --no-cache-dir -r /tmp/requirements-dev.txt

COPY backend/app /app/backend/app
COPY backend/tests /app/backend/tests
COPY pytest.ini /app/pytest.ini

CMD ["pytest", "-q"]