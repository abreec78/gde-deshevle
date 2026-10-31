FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY *.html *.css *.js manifest.webmanifest /srv/
COPY assets/ /srv/assets/
COPY data/ /srv/data/
COPY tools/private_compare_server.py tools/hosted_compare_server.py /srv/tools/
RUN useradd -m -u 10001 kupiora && chown -R kupiora:kupiora /srv
USER kupiora
EXPOSE 8080
CMD ["python", "tools/hosted_compare_server.py"]
