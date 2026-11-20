import { createApp } from "vue/dist/vue.esm-bundler.js";
import "../style.css";
createApp({
  data: () => ({
    token: sessionStorage.getItem("quiz_admin"),
    username: "",
    password: "",
    kind: "users",
    keyword: "",
    page: 1,
    total: 0,
    items: [],
    message: "",
    busy: false,
    form: null,
  }),
  computed: {
    currentUserId() {
      try { return String(JSON.parse(atob(this.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub); } catch { return null; }
    },
  },
  mounted() {
    if (this.token) this.load();
  },
  methods: {
    async api(path, method = "GET", body) {
      const r = await fetch("/quiz/api" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + this.token,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 401) {
          this.token = null;
          sessionStorage.removeItem("quiz_admin");
        }
        throw Error(d.message || "操作失败");
      }
      return d;
    },
    async login() {
      this.busy = true;
      try {
        const d = await this.api("/login", "POST", {
          username: this.username,
          password: this.password,
          admin: true,
        });
        this.token = d.token;
        sessionStorage.setItem("quiz_admin", d.token);
        this.password = "";
        await this.load();
      } catch (e) {
        this.message = e.message;
      } finally {
        this.busy = false;
      }
    },
    logout() {
      sessionStorage.removeItem("quiz_admin");
      this.token = null;
      this.items = [];
    },
    async load() {
      const kind = this.kind,
        page = this.page,
        keyword = this.keyword;
      this.items = [];
      try {
        const d = await this.api(
          "/admin/" +
            kind +
            "?page=" +
            page +
            "&keyword=" +
            encodeURIComponent(keyword),
        );
        if (
          this.kind !== kind ||
          this.page !== page ||
          this.keyword !== keyword
        )
          return;
        this.items = d.items;
        this.total = d.total;
      } catch (e) {
        this.message = e.message;
      }
    },
    tab(k) {
      this.kind = k;
      this.page = 1;
      this.keyword = "";
      this.form = null;
      this.load();
    },
    edit(q) {
      this.form = q
        ? { ...q }
        : this.kind === "users"
          ? { username: "", password: "", role: "USER" }
          : { text: "", a: "", b: "", c: "", d: "", answer: 0 };
    },
    async save() {
      this.busy = true;
      try {
        await this.api(
          "/admin/" + this.kind + (this.form.id ? "/" + this.form.id : ""),
          this.form.id ? "PUT" : "POST",
          this.form,
        );
        this.form = null;
        this.message = "保存成功";
        await this.load();
      } catch (e) {
        this.message = e.message;
      } finally {
        this.busy = false;
      }
    },
    isCurrentUser(q) { return this.kind === "users" && String(q.id) === this.currentUserId; },
    async remove(q) {
      if (this.isCurrentUser(q)) { this.message = "不能删除当前登录账号"; return; }
      if (!confirm("确定删除这条记录？")) return;
      try {
        await this.api("/admin/" + this.kind + "/" + q.id, "DELETE");
        if (this.items.length === 1 && this.page > 1) this.page--;
        await this.load();
        this.message = "已删除";
      } catch (e) {
        this.message = e.message;
      }
    },
    async reset(q) {
      if (!confirm("将 " + q.username + " 的密码重置为123456？")) return;
      try {
        const d = await this.api("/admin/users/" + q.id + "/reset", "POST", {});
        this.message = d.message;
      } catch (e) {
        this.message = e.message;
      }
    },
  },
  template: `<header><strong>Quiz 后台管理</strong><nav><a href="/quiz/">答题端</a> <button v-if="token" @click="logout">退出</button></nav></header><main><h1>后台管理</h1><p class="notice" role="status">{{message}}</p><form v-if="!token" class="card narrow" @submit.prevent="login"><h2>管理员登录</h2><p class="muted">仅管理员账号可访问工作台</p><label for="un">用户名</label><input id="un" v-model="username" required autocomplete="username"><label for="pw">密码</label><input id="pw" type="password" v-model="password" required autocomplete="current-password"><button :disabled="busy" style="margin-top:24px">{{busy?'登录中…':'登录'}}</button></form><template v-else><div class="row"><button @click="tab('users')" :class="{secondary:kind!=='users'}">用户管理</button><button @click="tab('questions')" :class="{secondary:kind!=='questions'}">题库管理</button></div><section class="card"><div class="row between"><h2>{{kind==='users'?'用户列表':'题目列表'}} <small>共 {{total}} 条</small></h2><button @click="edit()">{{kind==='users'?'新增用户':'新增题目'}}</button></div><form class="row" @submit.prevent="page=1;load()"><label for="search">关键词</label><input id="search" style="flex:1;min-width:150px" v-model="keyword" :placeholder="kind==='users'?'搜索用户名':'搜索题目内容'"><button>查询</button></form><div class="scroll"><table><thead><tr><th>ID</th><th>{{kind==='users'?'用户名':'题目内容'}}</th><th>{{kind==='users'?'角色':'答案'}}</th><th>操作</th></tr></thead><tbody><tr v-for="q in items" :key="q.id"><td>{{q.id}}</td><td>{{kind==='users'?q.username:q.text}}<small v-if="isCurrentUser(q)">（当前账号）</small></td><td>{{kind==='users'?(q.role==='ADMIN'?'管理员':'普通用户'):'ABCD'[q.answer]}}</td><td><button v-if="kind==='questions'" @click="edit(q)">编辑</button><button v-if="kind==='users'&&q.role==='USER'" class="secondary" @click="reset(q)">重置密码</button><button class="danger" :disabled="isCurrentUser(q)" :title="isCurrentUser(q)?'不能删除当前登录账号':'删除'" @click="remove(q)">删除</button></td></tr><tr v-if="!items.length"><td colspan="4">没有匹配记录</td></tr></tbody></table></div><div class="row" style="margin-top:20px"><button class="secondary" :disabled="page<=1" @click="page--;load()">上一页</button><span>第 {{page}} / {{Math.max(1,Math.ceil(total/10))}} 页</span><button class="secondary" :disabled="page*10>=total" @click="page++;load()">下一页</button></div></section><form v-if="form" class="card" @submit.prevent="save"><h2>{{form.id?'编辑题目':kind==='users'?'新增用户':'新增题目'}}</h2><template v-if="kind==='users'"><label for="newun">用户名</label><input id="newun" v-model="form.username" required pattern="[a-zA-Z0-9_]{3,32}"><label for="newpw">密码</label><input id="newpw" v-model="form.password" type="password" required minlength="6" maxlength="72"><label for="role">角色</label><select id="role" v-model="form.role"><option value="USER">普通用户</option><option value="ADMIN">管理员</option></select></template><template v-else><label for="text">题目内容</label><textarea id="text" v-model="form.text" required maxlength="1000"></textarea><div class="grid"><div v-for="(k,i) in ['a','b','c','d']"><label :for="k">选项 {{'ABCD'[i]}}</label><input :id="k" v-model="form[k]" required maxlength="500"></div></div><label for="answer">正确答案</label><select id="answer" v-model.number="form.answer"><option v-for="(k,i) in ['A','B','C','D']" :value="i">{{k}}</option></select></template><div class="row" style="margin-top:24px"><button :disabled="busy">保存</button><button type="button" class="secondary" @click="form=null">取消</button></div></form></template></main>`,
}).mount("#app");
