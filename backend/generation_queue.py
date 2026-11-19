"""Redis/RQ integration for durable, single-worker certificate generation."""
from redis import Redis
from rq import Queue
from rq.exceptions import NoSuchJobError


def connection(url):
    return Redis.from_url(url, socket_connect_timeout=2, socket_timeout=5, health_check_interval=30)


def queue_for(app):
    redis = connection(app.config['REDIS_URL'])
    redis.ping()
    return Queue(app.config['GENERATION_QUEUE_NAME'], connection=redis)


def enqueue_generation(app, generation_id):
    queue = queue_for(app)
    return queue.enqueue(
        'generation_worker.run_generation_job', generation_id,
        job_id=f'generation-{generation_id}',
        job_timeout=900,
        result_ttl=86400,
        failure_ttl=604800,
    )


def cancel_generation(app, rq_job_id):
    if not rq_job_id:
        return
    try:
        job = queue_for(app).fetch_job(rq_job_id)
        if job:
            job.cancel()
    except (NoSuchJobError, OSError):
        return
