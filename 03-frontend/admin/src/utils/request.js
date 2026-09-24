import axios from 'axios'
import { Message } from 'element-ui'

const TOKEN_KEY = 'cooking:admin:token'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

request.interceptors.request.use(config => {
  const token = window.localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  response => {
    const payload = response.data || {}
    if (payload.code !== 0) {
      const message = payload.message || '请求失败'
      Message.error(message)
      if (payload.code === 1001) {
        window.localStorage.removeItem(TOKEN_KEY)
        window.location.hash = '/login'
      }
      return Promise.reject(new Error(message))
    }
    return payload.data
  },
  error => {
    const payload = error.response && error.response.data
    const message = payload && payload.message ? payload.message : '网络异常，请稍后重试'
    Message.error(message)
    if (payload && payload.code === 1001) {
      window.localStorage.removeItem(TOKEN_KEY)
      window.location.hash = '/login'
    }
    return Promise.reject(error)
  }
)

export { TOKEN_KEY }
export default request
