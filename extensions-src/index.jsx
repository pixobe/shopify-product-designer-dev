import React from "react"
import ReactDOM from "react-dom/client" // if using React 18
import r2wc from "react-to-webcomponent"
import CustomizeButton from "./CustomizeButton";
const WcCustomizeButton = r2wc(CustomizeButton, React, ReactDOM,
{
  props: {
    label: "string",
  },
})
customElements.define("pixobe-customize-button", WcCustomizeButton)
