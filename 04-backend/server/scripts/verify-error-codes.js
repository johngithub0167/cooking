/**
 * 错误码一致性自检（BE-003）
 *
 * 目的：不是纸面比对，而是起一个临时 Express 实例，用真实 HTTP 请求逐个验证
 *      「错误码 → HTTP 状态 → 响应结构」与 02-design/api-design.md 第 1.2 节完全一致。
 *
 * 用法：
 *   node scripts/verify-error-codes.js              # 开发模式（未知错误返回原始 message）
 *   $env:NODE_ENV='production'; node scripts/verify-error-codes.js   # 生产模式（未知错误只返回通用提示）
 *
 * 说明：只用于本地自检，不注册到业务路由，不监听 3000（用 3999 临时端口），验证完进程即退出。
 */
const express = require('express');
const { Sequelize } = require('sequelize');

const { AppError, ERROR_CODES } = require('../src/utils/errors');
const errorHandler = require('../src/middlewares/errorHandler');
const notFound = require('../src/middlewares/notFound');

const PORT = 3999;
const isProduction = process.env.NODE_ENV === 'production';

/** 用例：期望值全部来自 api-design.md 第 1.2 节 */
const cases = [
  { name: 'PARAM_ERROR', thrower: () => AppError.badRequest('name 不能为空'), code: 1000, http: 400 },
  { name: 'UNAUTHORIZED', thrower: () => AppError.unauthorized(), code: 1001, http: 401 },
  { name: 'FORBIDDEN', thrower: () => AppError.forbidden(), code: 1002, http: 403 },
  { name: 'NOT_FOUND', thrower: () => AppError.notFound('菜品不存在'), code: 2001, http: 404 },
  { name: 'CONFLICT', thrower: () => AppError.conflict('分类名已存在'), code: 2002, http: 409 },
  { name: 'FILE_TYPE', thrower: () => AppError.fileTypeNotAllowed(), code: 3001, http: 400 },
  { name: 'FILE_TOO_LARGE', thrower: () => AppError.fileTooLarge(), code: 3002, http: 400 },
  { name: 'INTERNAL', thrower: () => AppError.internal(), code: 5000, http: 500 },
  {
    name: 'Sequelize 唯一约束',
    thrower: () => new Sequelize.UniqueConstraintError({ message: 'Duplicate entry' }),
    code: 2002,
    http: 409
  },
  {
    name: 'Sequelize 校验失败',
    thrower: () =>
      new Sequelize.ValidationError('validation error', [
        new Sequelize.ValidationErrorItem('name 不能为空', 'Validation error', 'name', '')
      ]),
    code: 1000,
    http: 400
  },
  {
    name: 'Sequelize 外键约束',
    thrower: () => new Sequelize.ForeignKeyConstraintError({ message: '外键约束失败' }),
    code: 1000,
    http: 400
  },
  {
    name: 'Sequelize 连接失败',
    thrower: () => new Sequelize.ConnectionRefusedError(new Error('connect ECONNREFUSED')),
    code: 5000,
    http: 500
  },
  {
    name: '未知异常',
    thrower: () => new Error('boom-detail-should-not-leak'),
    code: 5000,
    http: 500
  }
];

const app = express();

cases.forEach((c, index) => {
  app.get(`/case/${index}`, (req, res, next) => {
    next(c.thrower());
  });
});

// 未匹配路径 → 2001 / 404
app.use(notFound);
app.use(errorHandler);

function pad(text, width) {
  const str = String(text);
  // 中文按两个字符宽度估算，保证表格对齐
  const wide = (str.match(/[^\x00-\xff]/g) || []).length;
  return str + ' '.repeat(Math.max(0, width - str.length - wide));
}

async function check(url) {
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  const server = app.listen(PORT);
  await new Promise((resolve) => server.once('listening', resolve));

  let failed = 0;
  console.log('');
  console.log('错误码一致性自检（对照 api-design.md 第 1.2 节）');
  console.log(`运行模式：${isProduction ? 'production' : 'development'}`);
  console.log('');
  console.log(pad('场景', 22) + pad('期望', 14) + pad('实际', 14) + '结果');
  console.log('-'.repeat(64));

  for (let i = 0; i < cases.length; i += 1) {
    const c = cases[i];
    const { status, body } = await check(`http://127.0.0.1:${PORT}/case/${i}`);
    const shapeOk = Object.keys(body).sort().join(',') === 'code,data,message';
    const codeOk = body.code === c.code;
    const httpOk = status === c.http;
    // 生产模式下未知异常不得把原始 message 泄漏给前端
    const leakOk = !(isProduction && c.name === '未知异常' && body.message === 'boom-detail-should-not-leak');
    const ok = shapeOk && codeOk && httpOk && leakOk;
    if (!ok) failed += 1;
    console.log(
      pad(c.name, 22) +
        pad(`code=${c.code}/http=${c.http}`, 14) +
        pad(`code=${body.code}/http=${status}`, 14) +
        (ok ? 'PASS' : `FAIL ${shapeOk ? '' : '(结构异常) '}${codeOk ? '' : '(code) '}${httpOk ? '' : '(http) '}${leakOk ? '' : '(生产环境泄漏了原始错误信息)'}`)
    );
  }

  // 404 兜底
  const nf = await check(`http://127.0.0.1:${PORT}/api/not-exist`);
  const nfOk = nf.status === 404 && nf.body.code === ERROR_CODES.NOT_FOUND.code;
  if (!nfOk) failed += 1;
  console.log(
    pad('未匹配路径(404兜底)', 22) +
      pad(`code=2001/http=404`, 14) +
      pad(`code=${nf.body.code}/http=${nf.status}`, 14) +
      (nfOk ? 'PASS' : 'FAIL')
  );

  server.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? `全部通过（${cases.length + 1}/${cases.length + 1}）` : `存在失败用例：${failed}`);
  console.log('');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
