import axios from 'axios'
import { Toast } from 'vant'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

request.interceptors.response.use(
  response => {
    const payload = response.data || {}
    if (payload.code !== 0) {
      const message = payload.message || '请求失败'
      Toast.fail(message)
      return Promise.reject(new Error(message))
    }
    return payload.data
  },
  error => {
    const message = error.response && error.response.data && error.response.data.message
      ? error.response.data.message
      : '网络异常，请稍后重试'
    Toast.fail(message)
    return Promise.reject(error)
  }
)

export default request
