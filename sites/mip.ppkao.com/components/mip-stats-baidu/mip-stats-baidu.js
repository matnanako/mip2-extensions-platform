/**
 * @file 百度统计插件
 *
 * @author menglingjun, Jenny_L, dongshihao
 * From: mip-stats-baidu
 */
import './index.less'
export default class MIPStatsBaidu extends MIP.CustomElement {
  build () {
    let $ = require('zepto')
    let viewer = require('viewer')
    let util = require('util')
    let _hmt
    let customElement = require('customElement').create()

    customElement.prototype.createdCallback = function () {
      let elem = this.element
      let config = this.getConfig()
      let token = config.token

      /**
       * 检测token是否存在
       */
      if (token) {
        window._hmt = window._hmt || []
        _hmt.push([
          '_setAccount',
          token
        ])

        // XXX: 解决来自百度搜索，内外域名不一致问题
        if (viewer.isIframed) {
          bdSearchCase()
        }
        if (config && Array.isArray(config.conf) && config.conf.length) {
          let conf = config.conf
          for (let i = 0; i < conf.length; i++) {
            _hmt.push(conf[i])
          }
        }

        bindEle()

        let hm = document.createElement('script')
        hm.src = 'https://hm.baidu.com/hm.js?' + token
        $(elem).append(hm)
      } else {
        console.warn('token is unavailable') // eslint-disable-line
      }
    }

    /**
     * get config from script has type="application/json"
     *
     * @return {Object} config  return stats config
     */
    customElement.prototype.getConfig = function () {
      let config = {}
      let setconfig = this.element.getAttribute('setconfig')
      try {
        let script = this.element.querySelector('script[type="application/json"]')
        if (script) {
          let textContent = JSON.parse(script.textContent)
          if (JSON.stringify(textContent) !== '{}') {
            config.token = textContent.token
            util.fn.del(textContent, 'token')
            config.conf = this.objToArray(textContent)
          }
          return config
        }
      } catch (e) {
        console.warn('json is illegal') // eslint-disable-line
        console.warn(e) // eslint-disable-line
      }
      return {
        'token': this.element.getAttribute('token'),
        'conf': setconfig ? new Array(buildArry(decodeURIComponent(setconfig))) : null
      }
    }

    /**
     * JSON object to Array
     *
     * @param {Object} configObj configObj from script has type="application/json"
     * @returns {Object} outConfigArray return stats array
     */
    customElement.prototype.objToArray = function (configObj) {
      let outConfigArray = []
      if (!configObj) {
        return
      }
      for (let key in configObj) {
        if (configObj.hasOwnProperty(key) && Array.isArray(configObj[key])) {
          configObj[key].unshift(key)
          outConfigArray.push(configObj[key])
        }
      }
      return outConfigArray
    }

    // 绑定事件追踪
    function bindEle () {
      // 获取所有需要触发的dom
      let tagBox = document.querySelectorAll('*[data-stats-baidu-obj]')

      for (let index = 0; index < tagBox.length; index++) {
        let statusData = tagBox[index].getAttribute('data-stats-baidu-obj')

        /**
         * 检测statusData是否存在
         */
        if (!statusData) {
          continue
        }

        try {
          statusData = JSON.parse(decodeURIComponent(statusData))
        } catch (e) {
          console.warn('事件追踪data-stats-baidu-obj数据不正确')
          continue
        }

        let eventtype = statusData.type

        /**
         * 检测传递数据是否存在
         */
        if (!statusData.data) {
          continue
        }

        let data = buildArry(statusData.data)

        if (eventtype !== 'click' && eventtype !== 'mouseup' && eventtype !== 'load') {
          // 事件限制到click,mouseup,load(直接触发)
          continue
        }

        if ($(tagBox[index]).hasClass('mip-stats-eventload')) {
          continue
        }

        $(tagBox[index]).addClass('mip-stats-eventload')

        if (eventtype === 'load') {
          _hmt.push(data)
        } else {
          tagBox[index].addEventListener(eventtype, function (event) {
            let tempData = this.getAttribute('data-stats-baidu-obj')
            if (!tempData) {
              return
            }
            let statusJson
            try {
              statusJson = JSON.parse(decodeURIComponent(tempData))
            } catch (e) {
              console.warn('事件追踪data-stats-baidu-obj数据不正确')
              return
            }
            if (!statusJson.data) {
              return
            }
            let attrData = buildArry(statusJson.data)
            _hmt.push(attrData)
          }, false)
        }
      }
    }

    // 数据换转
    function buildArry (arrayStr) {
      if (!arrayStr) {
        return
      }

      let strArr = arrayStr.slice(1, arrayStr.length - 1).split(',')
      let newArray = []

      for (let index = 0; index < strArr.length; index++) {
        let item = strArr[index].replace(/(^\s*)|(\s*$)/g, '').replace(/'/g, '')
        if (item === 'false' || item === 'true') {
          item = Boolean(item)
        }

        newArray.push(item)
      }
      return newArray
    }

    /**
     * 解决来自百度搜索，内外域名不一致问题
     */
    function bdSearchCase () {
      let originUrl = ''
      let hashObj = {}

      let hashWord = MIP.hash.get('word') || ''
      let hashEqid = MIP.hash.get('eqid') || ''
      let from = MIP.hash.get('from') || ''

      if (isMatch(from, 'result')) {
        if ((hashWord || hashEqid) && document.referrer) {
          hashObj.url = ''
          hashObj.eqid = hashEqid
          hashObj.word = hashWord
          originUrl = document.referrer
        }
      } else {
        hashObj.url = ''
        originUrl = location.origin + location.pathname + location.search
      }
      _hmt.push(['_setReferrerOverride', makeReferrer(originUrl, hashObj)])
    }

    /**
     * to determine whether from the targetFrom
     *
     * @param  {string} from  referrer from mipService
     * @param  {string} targetFrom  the target that `from` need to match.
     * @returns {boolean}     return whether from the results page
     */
    function isMatch (from, targetFrom) {
      if (from && targetFrom && from === targetFrom) {
        return true
      } else {
        return false
      }
    }

    /**
     * 生成百度统计_setReferrerOverride对应的referrer
     *
     * @param  {string} url       需要被添加参数的 url
     * @param  {Object} hashObj   参数对象
     * @returns {string}           拼装后的 url
     */
    function makeReferrer (url, hashObj) {
      let referrer = ''
      let conjMark = url.indexOf('?') < 0 ? '?' : '&'
      let urlData = ''
      for (let key in hashObj) {
        urlData += '&' + key + '=' + hashObj[key]
      }
      urlData = urlData.slice(1)
      if (url.indexOf('#') < 0 && urlData) {
        referrer = url + conjMark + urlData
      } else {
        referrer = url.replace('#', conjMark + urlData + '#')
      }
      return referrer
    }
    return customElement
  }
}
