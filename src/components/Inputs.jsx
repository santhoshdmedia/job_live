/* eslint-disable react/prop-types */
import { Form, Input, Select } from "antd";
import JoditEditor from "jodit-react";

const Inputs = ({ type, placeholder, name, errorMsg, options = [], label, onChange, w }) => {
  let width = w || "!w-full";
  const config = {
    buttons: ["bold", "italic", "underline", "superscript", "subscript", "preview", "selectall", "table", "font", "ul", "ol", "align", "image"],
    // useTabs: false,
    // allowTabNavigation: false,
    // events: {
    //   keydown: function (event) {
    //     if (event.key === "Tab") {
    //       event.preventDefault();
    //       const editor = this;
    //       if (editor && editor.s) {
    //         editor.s.insertHTML("<br>");
    //       }
    //     }
    //   },
    // },
  };

  const DisplayForms = () => {
    switch (type) {
      case "text":
      case "number":
        return (
          <Form.Item label={label} name={name} rules={[{ required: true, message: `${errorMsg} is Required` }]}>
            <Input type={type} placeholder={placeholder} className={`${width} !h-[50px]`} />
          </Form.Item>
        );
      case "select":
        return (
          <Form.Item label={label} name={name} rules={[{ required: true, message: `${errorMsg} is Required` }]}>
            <Select
              placeholder={placeholder}
              className={`${width} w-full !h-[50px]`}
              onChange={(e) => {
                onChange(e);
              }}
            >
              {options.map((res, index) => {
                return (
                  <Select.Option key={index} value={res.value}>
                    {res.value}
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
        );
      case "editor":
        return (
          <Form.Item label={label} name={name} rules={[{ required: true, message: `${errorMsg} is Required` }]}>
            <JoditEditor />
          </Form.Item>
        );

      default:
        return "Unknown";
    }
  };

  return <div>{DisplayForms()}</div>;
};

export default Inputs;
