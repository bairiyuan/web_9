package com.quiz;
import org.springframework.boot.*;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.autoconfigure.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.dao.DataIntegrityViolationException;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
@SpringBootApplication
@RestController
@RequestMapping("/api")
public class App {
 final JdbcTemplate db; final BCryptPasswordEncoder encoder=new BCryptPasswordEncoder(); final SecretKey key;
 public App(JdbcTemplate db){this.db=db;key=Keys.hmacShaKeyFor(Base64.getDecoder().decode(System.getenv("JWT_SECRET")));}
 public static void main(String[] a){SpringApplication.run(App.class,a);}
 static ResponseStatusException error(int code,String m){return new ResponseStatusException(HttpStatus.valueOf(code),m);}
 String str(Map<String,Object>b,String k){Object v=b.get(k);if(!(v instanceof String s)||s.isBlank()||s.length()>1000)throw error(400,"请检查输入："+k);return s.trim();}
 String password(Map<String,Object>b){String s=str(b,"password");if(s.length()<6||s.length()>72)throw error(400,"密码长度须为6至72个字符");return s;}
 String username(Map<String,Object>b){String s=str(b,"username");if(!s.matches("[a-zA-Z0-9_]{3,32}"))throw error(400,"用户名须为3至32位字母、数字或下划线");return s;}
 Map<String,Object> user(HttpServletRequest r,boolean admin){try{String h=r.getHeader("Authorization");if(h==null||!h.startsWith("Bearer "))throw error(401,"请先登录");Claims c=Jwts.parser().verifyWith(key).build().parseSignedClaims(h.substring(7)).getPayload();var u=db.queryForMap("SELECT * FROM users WHERE id=?",Long.parseLong(c.getSubject()));if(((Number)u.get("token_version")).intValue()!=((Number)c.get("ver")).intValue())throw error(401,"登录已失效");if(admin&&!u.get("role").equals("ADMIN"))throw error(403,"需要管理员权限");return u;}catch(ResponseStatusException e){throw e;}catch(Exception e){throw error(401,"登录已失效，请重新登录");}}
 @PostMapping("/register") public Map<?,?> register(@RequestBody Map<String,Object>b){insertUser(username(b),password(b),"USER");return Map.of("message","注册成功");}
 void insertUser(String n,String p,String role){try{db.update("INSERT INTO users(username,password,role) VALUES(?,?,?)",n,encoder.encode(p),role);}catch(DataIntegrityViolationException e){throw error(409,"用户名已存在");}}
 @PostMapping("/login") public Map<?,?> login(@RequestBody Map<String,Object>b){var rows=db.queryForList("SELECT * FROM users WHERE username=?",str(b,"username"));if(rows.isEmpty()||!encoder.matches(str(b,"password"),(String)rows.getFirst().get("password")))throw error(401,"用户名或密码错误");var u=rows.getFirst();if(Boolean.TRUE.equals(b.get("admin"))&&!u.get("role").equals("ADMIN"))throw error(403,"普通用户无法登录管理端");String token=Jwts.builder().subject(u.get("id").toString()).claim("ver",u.get("token_version")).issuedAt(new Date()).expiration(new Date(System.currentTimeMillis()+7200000)).signWith(key).compact();return Map.of("token",token,"username",u.get("username"),"role",u.get("role"));}
 @GetMapping("/questions") public Object quiz(HttpServletRequest r){user(r,false);return db.queryForList("SELECT id,text,a,b,c,d FROM questions ORDER BY id LIMIT 50");}
 @PostMapping("/submit") public Object submit(HttpServletRequest r,@RequestBody Map<String,Object>b){user(r,false);if(!(b.get("answers") instanceof Map<?,?> answers)||answers.isEmpty()||answers.size()>50)throw error(400,"请选择答案");int correct=0;var results=new ArrayList<Map<String,Object>>();for(var e:answers.entrySet()){long id;int selected;try{id=Long.parseLong(e.getKey().toString());selected=Integer.parseInt(e.getValue().toString());}catch(Exception ex){throw error(400,"答案格式错误");}var rows=db.queryForList("SELECT id,text,answer FROM questions WHERE id=?",id);if(rows.isEmpty()||selected<0||selected>3)throw error(400,"题目或答案无效");var q=rows.getFirst();boolean ok=((Number)q.get("answer")).intValue()==selected;if(ok)correct++;q.put("correct",ok);results.add(q);}return Map.of("correct",correct,"total",answers.size(),"score",Math.round(correct*100.0/answers.size()),"results",results);}
 @GetMapping("/admin/{kind}") public Object list(HttpServletRequest r,@PathVariable String kind,@RequestParam(defaultValue="")String keyword,@RequestParam(defaultValue="1")int page){user(r,true);String table=table(kind);int p=Math.max(1,page);String field=kind.equals("users")?"username":"text";String where=" WHERE "+field+" LIKE ?";String cols=kind.equals("users")?"id,username,role":"*";return Map.of("items",db.queryForList("SELECT "+cols+" FROM "+table+where+" ORDER BY id DESC LIMIT 10 OFFSET ?","%"+keyword+"%",(p-1)*10),"total",db.queryForObject("SELECT COUNT(*) FROM "+table+where,Integer.class,"%"+keyword+"%"),"page",p);}
 String table(String k){if(!Set.of("users","questions").contains(k))throw error(404,"不存在");return k;}
 @PostMapping("/admin/users") public Object addUser(HttpServletRequest r,@RequestBody Map<String,Object>b){user(r,true);String role=str(b,"role");if(!Set.of("USER","ADMIN").contains(role))throw error(400,"角色错误");insertUser(username(b),password(b),role);return Map.of("message","用户已创建");}
 @DeleteMapping("/admin/{kind}/{id}") public Object delete(HttpServletRequest r,@PathVariable String kind,@PathVariable long id){var u=user(r,true);table(kind);if(kind.equals("users")&&((Number)u.get("id")).longValue()==id)throw error(400,"不能删除当前管理员");if(db.update("DELETE FROM "+kind+" WHERE id=?",id)==0)throw error(404,"记录不存在");return Map.of("message","已删除");}
 @PostMapping("/admin/users/{id}/reset") public Object reset(HttpServletRequest r,@PathVariable long id){user(r,true);if(db.update("UPDATE users SET password=?,token_version=token_version+1 WHERE id=? AND role='USER'",encoder.encode("123456"),id)==0)throw error(400,"只能重置普通用户密码");return Map.of("message","密码已重置为123456");}
 Object[] question(Map<String,Object>b){int answer;try{answer=Integer.parseInt(b.get("answer").toString());}catch(Exception e){throw error(400,"答案无效");}if(answer<0||answer>3)throw error(400,"答案无效");for(String k:List.of("a","b","c","d"))if(str(b,k).length()>500)throw error(400,"选项长度不能超过500");return new Object[]{str(b,"text"),str(b,"a"),str(b,"b"),str(b,"c"),str(b,"d"),answer};}
 @PostMapping("/admin/questions") public Object addQuestion(HttpServletRequest r,@RequestBody Map<String,Object>b){user(r,true);db.update("INSERT INTO questions(text,a,b,c,d,answer) VALUES(?,?,?,?,?,?)",question(b));return Map.of("message","题目已创建");}
 @PutMapping("/admin/questions/{id}") public Object editQuestion(HttpServletRequest r,@PathVariable long id,@RequestBody Map<String,Object>b){user(r,true);var args=new ArrayList<>(Arrays.asList(question(b)));args.add(id);if(db.update("UPDATE questions SET text=?,a=?,b=?,c=?,d=?,answer=? WHERE id=?",args.toArray())==0)throw error(404,"题目不存在");return Map.of("message","题目已更新");}
 @Bean public org.springframework.boot.CommandLineRunner seed(){return args->{if(db.queryForObject("SELECT COUNT(*) FROM users WHERE role='ADMIN'",Integer.class)==0)insertUser("admin",System.getenv("ADMIN_PASSWORD"),"ADMIN");if(db.queryForObject("SELECT COUNT(*) FROM questions",Integer.class)==0){String[][]qs={{"HTML 在网页中主要负责什么？","页面结构","页面样式","数据库","服务器部署"},{"CSS 主要用于什么？","定义页面样式","管理用户权限","存储数据","签发JWT"},{"JWT 通常用于什么？","身份验证","图片压缩","页面排版","数据库备份"},{"Nginx 可以提供哪项功能？","反向代理","编译Java","编辑图片","执行Vue组件"},{"HTTP GET 通常用于什么？","读取资源","删除数据库","更改密码","创建用户"},{"Vue 中 v-model 的作用是什么？","双向数据绑定","声明路由","加密密码","部署服务"},{"MySQL 属于哪类数据库？","关系型数据库","文件服务器","浏览器","代理服务器"},{"密码应该如何保存？","使用安全哈希","明文保存","放在URL","写入前端代码"},{"管理员接口应在哪里检查权限？","服务端","仅隐藏按钮","仅检查页面地址","无需检查"},{"分页查询主要有什么作用？","减少单次返回的数据量","自动备份","替代登录","加密数据库"},{"Java Spring Boot 的作用是什么？","构建后端应用","替代浏览器","编辑视频","美化CSS"},{"HTTP 401 表示什么？","未通过身份认证","请求成功","页面重定向","服务器启动"}};for(var q:qs){int answer=java.util.concurrent.ThreadLocalRandom.current().nextInt(4);String tmp=q[answer+1];q[answer+1]=q[1];q[1]=tmp;db.update("INSERT INTO questions(text,a,b,c,d,answer) VALUES(?,?,?,?,?,?)",q[0],q[1],q[2],q[3],q[4],answer);}}};}
 @ExceptionHandler(ResponseStatusException.class) @ResponseStatus public org.springframework.http.ResponseEntity<?> handle(ResponseStatusException e){return org.springframework.http.ResponseEntity.status(e.getStatusCode()).body(Map.of("message",e.getReason()));}
}

