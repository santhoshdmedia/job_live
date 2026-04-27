/* eslint-disable react/prop-types */
import { Tooltip } from "antd";
import { MENU_DATA } from "../helper/data";
import { ICON_HELPER } from "../helper/iconhelper";
import { Link, useHref, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { checkloginstatus } from "../api";
import { admintoken } from "../helper/notification_helper";
import _ from "lodash";
import React from "react";
import { isLoginSuccess } from "../redux/slices/authSlice";

const SideNavbar = () => {
  const navigate = useNavigate();
  const path = useHref();
  const dispatch = useDispatch();
  const [new_menu_data, setNew_menu_data] = useState(MENU_DATA);
  const { user } = useSelector((state) => state.authSlice);

  const [open, setOpen] = useState([]);

  useEffect(() => {
    const updatedMenuData = MENU_DATA.filter((data) => {
      return Array.isArray(data.for) && data.for.includes(user.role);
    });

    setNew_menu_data(updatedMenuData);
  }, [user]);

  const fetchdata = async () => {
    try {
      const result = await checkloginstatus();
      const data = _.get(result, "data.data", "");
      dispatch(isLoginSuccess(data));
      if (_.isEmpty(data)) {
        localStorage.removeItem(admintoken);
        return navigate("/");
      }
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchdata();
  }, []);

  useEffect(() => {
    if (["/categories/main-category"].includes(path)) {
      setOpen([4]);
    }
  }, []);

  let custom_style = `!h-[50px] rounded-r-lg center_div hover:bg-primary hover:text-white justify-start px-2  w-full`;

  const CustomDisplay = ({ res, index, extra }) => {
    return (
      <Link
        onClick={() => {
          setOpen((prev) => {
            if (prev.includes(res.id)) {
              return prev.filter((id) => id !== res.id);
            } else {
              return [...prev, res.id];
            }
          });
        }}
        to={extra ? "" : res.to}
        key={index}
        className={`${custom_style} ${res.special.includes(path) ? " border-primary bg-primary text-white" : " border-white"}`}
      >
        <Tooltip title={res.name} placement="right">
          <h1 className="!text-sm center_div justify-start gap-x-2">
            {res.icon && <res.icon className="text-sm cursor-pointer text-inherit" />}
            {res.name}
          </h1>
        </Tooltip>
      </Link>
    );
  };

  return (
    <div className="size-full bg-white flex border-r px-2  flex-col items-center rounded-lg   relative gap-y-2">
      {/* <div className="h-[50px] center_div"></div> */}
      {new_menu_data.map((res, index) => {
        return (
          <>
            {!_.isEmpty(_.get(res, "children", [])) ? (
              <>
                <CustomDisplay res={res} index={index} extra={true} />

                {open.includes(res.id) && (
                  <>
                    {_.get(res, "children", []).map((res2, index) => {
                      return <CustomDisplay res={res2} key={index} index={index} />;
                    })}
                  </>
                )}
              </>
            ) : (
              <CustomDisplay res={res} index={index} />
            )}
          </>
        );
      })}
    </div>
  );
};

export default SideNavbar;
