/* eslint-disable react/prop-types */

import { useHref } from "react-router-dom";
import { MENU_DATA } from "../helper/data";
import { Input, Select, Tag } from "antd";
import _ from "lodash";

const DefaultTile = ({ title, add = false, handleFilterChange, filterData = [], filter = false, addText = "", formStatus, setFormStatus, addModal = false, addModalText = "", modalFormStatus, setModalFormStatus, search = false, setSearch }) => {
  const path = useHref();

  // let GET_ICON = () => {
  //   let icon = MENU_DATA.filter((res) => {
  //     return !_.isEmpty(_.get(res, "children", [])) ? res.special.includes(path.split("/")[2]) : res.special.includes(path.split("/")[1]);
  //   })[0].icon;
  //   return <Icon className="!text-black text-lg" />;
  // };

  return (
    <div className="h-[50px] !bg-white px-4 rounded-lg mb-2 flex items-center  font-medium text-black justify-between">
      <div className="flex items-center gap-x-2">
        {/* <h1>{GET_ICON()}</h1> */}
        <h1>{title}</h1>
      </div>
      <div className="flex">
        {add && (
          <Tag
            onClick={() => {
              setFormStatus(!formStatus);
            }}
            className={`text-[12px] cursor-pointer ${formStatus ? "bg-secondary" : "bg-primary"} text-white px-4 py-1 border rounded`}
          >
            {formStatus ? "cancel" : `Add ${addText}`}
          </Tag>
        )}
        {addModal && (
          <Tag
            onClick={() => {
              setModalFormStatus(!modalFormStatus);
            }}
            className={`text-[12px] cursor-pointer bg-primary text-white px-4 py-1 border rounded`}
          >
            {`Add ${addModalText}`}
          </Tag>
        )}
        {search && <Input placeholder="search" onChange={(e) => setSearch(e.target.value)} />}
        {filter && (
          <>
            <Select placeholder="Filter By Main Category" className="w-[15rem]" allowClear onChange={(value) => handleFilterChange(value)}>
              {filterData.map((res) => (
                <Select.Option key={res._id} value={res._id}>
                  {res.main_category_name}
                </Select.Option>
              ))}
            </Select>
          </>
        )}
      </div>
    </div>
  );
};

export default DefaultTile;
