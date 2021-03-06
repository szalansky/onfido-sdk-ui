import { h, render, Component } from 'preact'
import { Provider } from 'react-redux'
import { store, events, connect as ws } from 'onfido-sdk-core'
import Modal from './components/Modal'
import Router from './components/Router'
import forEach from 'object-loops/for-each'
import mapValues from 'object-loops/map'
import Tracker from './Tracker'

Tracker.setUp()



const ModalApp = ({ options:{ useModal, isModalOpen, buttonId, ...otherOptions},
                    ...otherProps}) =>
  <Modal {...{useModal, buttonId}} isOpen={isModalOpen}>
    <Router options={otherOptions} {...otherProps}/>
  </Modal>

const ContainerPure = ({ options, socket }) =>
  <Provider store={store}>
    <ModalApp options={options} socket={socket}/>
  </Provider>

class Container extends Component {
  componentWillMount () {
    const { token, socketUrl } = this.props.options
    this.setState({ socket:ws(token, socketUrl) })
  }

  componentWillReceiveProps (nextProps) {
    const { token: nextToken, socketUrl: nextSocketUrl } = nextProps.options
    const { token, socketUrl } = this.props.options
    if (token !== nextToken || socketUrl !== nextSocketUrl) {
      this.setState({ socket:ws(nextToken, nextSocketUrl) })
    }
  }

  render = ({options}) =>
    <ContainerPure {...this.props} socket={this.state.socket}/>
}

/**
 * Renders the Onfido component
 *
 * @param {DOMelement} [merge] preact requires the element which was created from the first render to be passed as 3rd argument for a rerender
 * @returns {DOMelement} Element which was generated from render
 */
const onfidoRender = (options, el, merge) => {
  return render( <Container options={options}/>, el, merge)
}

const stripOneCapture = ({blob, documentType, id, side}) => {
  const capture = {id, blob}
  if (documentType) capture.documentType = documentType
  if (side) capture.side = side
  return capture
}

const stripCapturesHash = captures => mapValues(captures,
  capture => capture ? stripOneCapture(capture) : null)

const getCaptures = () => stripCapturesHash(events.getCaptures())

function bindEvents (options) {
  const eventListenersMap = {
    ready: () => options.onReady(),
    documentCapture: () => options.onDocumentCapture(getCaptures().documentCapture),
    documentBackCapture: () => options.onDocumentCapture(getCaptures().documentBackCapture),
    faceCapture: () => options.onFaceCapture(getCaptures().faceCapture),
    complete: () => options.onComplete(getCaptures()),
    onError: () => {
      Tracker.sendError("socket error");
      options.onError()
    }
  }

  forEach(eventListenersMap, (listener, event) => events.on(event, listener))
  return eventListenersMap;
}

function unbindEvents (eventListenersMap) {
  forEach(eventListenersMap, (listener, event) => {
    events.off(event, listener)
  })
}

function rebindEvents(newOptions, previousEventListenersMap){
  if (previousEventListenersMap) unbindEvents(previousEventListenersMap)
  return bindEvents(newOptions)
}


const Onfido = {}

Onfido.getCaptures = () => getCaptures()

const noOp = ()=>{}

const defaults = {
  token: 'some token',
  buttonId: 'onfido-button',
  containerId: 'onfido-mount',
  onReady: noOp,
  onDocumentCapture: noOp,
  onFaceCapture: noOp,
  onComplete: noOp,
  onError: noOp
}


Onfido.init = (opts) => {
  Tracker.track()
  const options = { ...defaults, ...opts }
  const eventListenersMap = bindEvents(options)

  const containerEl = document.getElementById(options.containerId)
  const element = onfidoRender(options, containerEl)

  return {
    options,
    element,
    eventListenersMap,
    /**
     * Does a merge with previous options and rerenders
     *
     * @param {Object} changedOptions shallow diff of the initialised options
     */
    setOptions (changedOptions) {
      this.options = {...this.options,...changedOptions};
      this.eventListenersMap = rebindEvents(this.options, this.eventListenersMap);
      this.element = onfidoRender( this.options, containerEl, this.element )
      return this.options;
    },

    tearDown() {
      render(null, containerEl, this.element)
    }
  }
}

export default Onfido
