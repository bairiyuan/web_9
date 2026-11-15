#!/usr/bin/env python3
"""Run as root after uploading release to /tmp/quiz-release.tar.gz. Never logs secrets."""
import pathlib,subprocess,secrets,base64,os,tarfile,datetime

def run(*args,**kw):return subprocess.run(args,check=True,**kw)
root=pathlib.Path('/opt/quiz'); root.mkdir(exist_ok=True)
# Only quiz-specific new files are installed; existing site files are not edited.
for p in ['/etc/quiz','/var/www/quiz','/opt/quiz/backups']:pathlib.Path(p).mkdir(parents=True,exist_ok=True)
if not pathlib.Path('/etc/quiz/quiz.env').exists():
 password=secrets.token_hex(24);admin=secrets.token_urlsafe(16);jwt=base64.b64encode(secrets.token_bytes(48)).decode()
 sql=f"CREATE DATABASE IF NOT EXISTS quiz CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'quiz_app'@'127.0.0.1' IDENTIFIED BY '{password}'; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON quiz.* TO 'quiz_app'@'127.0.0.1';"
 run('mysql',input=sql.encode())
 env=pathlib.Path('/etc/quiz/quiz.env');env.write_text(f'DB_PASSWORD={password}\nJWT_SECRET={jwt}\nADMIN_PASSWORD={admin}\n');env.chmod(0o600)
run('bash','-c','id quiz >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin quiz')
release=pathlib.Path('/tmp/quiz-release')
with tarfile.open('/tmp/quiz-release.tar.gz') as tf:tf.extractall(release,filter='data')
import shutil
if (root/'quiz.jar').exists():shutil.copy2(root/'quiz.jar',root/'backups'/('quiz-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.jar'))
shutil.copy2(release/'quiz.jar',root/'quiz.jar')
shutil.copytree(release/'www','/var/www/quiz',dirs_exist_ok=True)
shutil.copy2(release/'quiz.service','/etc/systemd/system/quiz.service')
# Shared existing site-routes include picks up only this new file.
shutil.copy2(release/'quiz.conf','/etc/nginx/site-routes/quiz.conf')
pathlib.Path('/etc/nginx/conf.d/quiz-rate-limit.conf').write_text('limit_req_zone $binary_remote_addr zone=quiz_api:1m rate=10r/s;\n')
jres=[p for p in (root/'runtime').iterdir() if p.is_dir() and (p/'bin/java').exists()]
if not (root/'runtime/java').exists():(root/'runtime/java').symlink_to(jres[0].name)
run('nginx','-t')
run('systemctl','daemon-reload');run('systemctl','enable','--now','quiz');run('systemctl','reload','nginx')
print('Quiz installed; credentials remain in /etc/quiz/quiz.env')
