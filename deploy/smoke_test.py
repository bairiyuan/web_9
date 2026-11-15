"""Production smoke test: creates and cleans only qa_* records in the Quiz database."""
import json,urllib.request,urllib.error,uuid,pathlib
base='http://127.0.0.1/quiz/api';passed=[]
def req(path,method='GET',body=None,token=None,expect=200):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 r=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:
  with urllib.request.urlopen(r,timeout=20) as f:status=f.status;d=json.load(f)
 except urllib.error.HTTPError as e:status=e.code;d=json.load(e)
 assert status==expect,(path,status,d)
 return d
secret=dict(line.split('=',1) for line in pathlib.Path('/etc/quiz/quiz.env').read_text().splitlines())
a=req('/login','POST',{'username':'admin','password':secret['ADMIN_PASSWORD'],'admin':True})['token']
name='qa_'+uuid.uuid4().hex[:12];uid=None;qid=None
try:
 req('/register','POST',{'username':name,'password':'TestPass123'})
 req('/register','POST',{'username':name,'password':'TestPass123'},expect=409)
 u=req('/login','POST',{'username':name,'password':'TestPass123'})['token']
 req('/login','POST',{'username':name,'password':'TestPass123','admin':True},expect=403)
 req('/admin/users',token=u,expect=403);req('/questions',expect=401)
 passed.append('注册、重复注册、普通用户登录、管理员权限隔离、匿名访问限制')
 users=req('/admin/users?keyword='+name,token=a);uid=users['items'][0]['id'];assert users['total']==1
 req('/admin/users/'+str(uid)+'/reset','POST',{},a)
 req('/questions',token=u,expect=401)
 u=req('/login','POST',{'username':name,'password':'123456'})['token']
 passed.append('用户关键词查询、密码重置、旧JWT撤销、新密码登录')
 q={'text':name,'a':'1','b':'2','c':'3','d':'4','answer':2}
 req('/admin/questions','POST',q,a)
 qid=req('/admin/questions?keyword='+name,token=a)['items'][0]['id']
 q['answer']=1;q['text']=name+' edited';req('/admin/questions/'+str(qid),'PUT',q,a)
 questions=req('/questions',token=u);assert all('answer' not in x for x in questions)
 result=req('/submit','POST',{'answers':{str(qid):1}},u);assert result['score']==100
 result=req('/submit','POST',{'answers':{str(qid):0}},u);assert result['score']==0
 req('/submit','POST',{'answers':{str(qid):8}},u,expect=400)
 assert len(req('/admin/questions?page=1',token=a)['items'])==10
 assert len(req('/admin/questions?page=2',token=a)['items'])>=1
 passed.append('题目新增、查询、修改、分页、答案隐藏、服务端计分、无效答案拒绝')
 # Test admin-created user and admin role.
 n2=name+'_a';req('/admin/users','POST',{'username':n2,'password':'TestPass123','role':'ADMIN'},a)
 aid=req('/admin/users?keyword='+n2,token=a)['items'][0]['id']
 try:
  at=req('/login','POST',{'username':n2,'password':'TestPass123','admin':True})['token']
  req('/admin/users',token=at)
  req('/admin/users/'+str(aid)+'/reset','POST',{},a,expect=400)
 finally:req('/admin/users/'+str(aid),'DELETE',token=a)
 passed.append('管理端创建管理员、角色登录、禁止重置管理员密码')
finally:
 if qid:req('/admin/questions/'+str(qid),'DELETE',token=a)
 if uid:req('/admin/users/'+str(uid),'DELETE',token=a)
print(json.dumps({'passed':passed,'cleanup':'测试用户和测试题目已删除'},ensure_ascii=False))
