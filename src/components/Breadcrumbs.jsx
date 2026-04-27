/* eslint-disable react/prop-types */
import { Breadcrumb } from "antd";
import { useNavigate } from "react-router-dom";

const Breadcrumbs = ({ title }) => {
  const navigation = useNavigate();
  return (
    <div className="pb-6">
      <Breadcrumb separator=">">
        <Breadcrumb.Item
          onClick={() => {
            navigation("/");
          }}
          className="!font-medium !cursor-pointer !text-sky-500"
        >
          Home
        </Breadcrumb.Item>
        <Breadcrumb.Item
          onClick={() => {
            navigation(-1);
          }}
          className="!font-medium !text-primary !cursor-pointer"
        >
          Back
        </Breadcrumb.Item>
        <Breadcrumb.Item className="!font-light !text-slate-400">{title}</Breadcrumb.Item>
      </Breadcrumb>
    </div>
  );
};

export default Breadcrumbs;
