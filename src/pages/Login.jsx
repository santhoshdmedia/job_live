import { Button, Checkbox, Form, Input } from "antd";
import { LabelHelper } from "../components/LabelHelper";
import { EmailValidation, PasswordValidation } from "../helper/formvalidation";
import { useEffect, useState } from "react";
import { login } from "../api";
import _, { toLower } from "lodash";
import {
  admintoken,
  ERROR_NOTIFICATION,
  SUCCESS_NOTIFICATION,
} from "../helper/notification_helper";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { isLoginSuccess } from "../redux/slices/authSlice";

import { IMAGE_HELPER } from "../helper/imagehelper";

const Login = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const validValues = toLower(values.email);
      const result = await login({
        email: validValues,
        password: values.password,
      });

      if (_.isEmpty(_.get(result, "data.data", []))) {
        setLoading(false);
        return ERROR_NOTIFICATION("Invalid credentials");
      }

      dispatch(isLoginSuccess(_.get(result, "data.data", {})));
      localStorage.setItem(admintoken, _.get(result, "data.data.token", ""));
      localStorage.setItem(
        "userprofile",
        JSON.stringify(_.get(result, "data.data", "")),
      );
      SUCCESS_NOTIFICATION(result);

      setTimeout(() => {
        navigate("/dashboard");
        form.resetFields();
      }, 1500);
    } catch (err) {
      console.log(err);
      ERROR_NOTIFICATION(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem(admintoken)) navigate("/dashboard");
  }, []);

  return (
    <div className="min-h-screen  flex overflow-hidden bg-white font-sans">
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className="lg:w-[46%] hidden lg:block h-screen border-[40px] border-white">
        <div
          className="hidden lg:flex  flex-col h-full justify-between p-10 relative overflow-hidden   rounded-2xl"
          style={{
            background:
              "linear-gradient(145deg, #7c6ef7 0%, #9b8df9 50%, #b3a6fb 100%)",
          }}
        >
          {/* subtle noise / grain overlay */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
              backgroundSize: "200px 200px",
            }}
          />

          {/* top content */}
          <div className="relative z-10">
            <p className="text-white  font-light tracking-wide text-3xl">
              {" "}
              <strong className="text-4xl font-bold">
                Simplify
              </strong> <br /> customer relationships with
            </p>
            <h1 className="text-white text-5xl font-extrabold leading-tight mt-1 drop-shadow-sm">
              Job Sheet.
            </h1>
            <p className="text-white/60 text-sm mt-3 tracking-widest uppercase">
              Track · Assign · Deliver
            </p>
          </div>

          {/* 3-D hero illustration */}
          <div className="relative z-10 flex items-end justify-center flex-1 mt-8">
            <img
              src={IMAGE_HELPER.LOGIN_IMAGE}
              alt="Job Sheet 3D illustration"
              className="w-full  object-contain drop-shadow-2xl
                       animate-[float_4s_ease-in-out_infinite]"
            />
          </div>

          {/* floating decorative blobs */}
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-2 bg-white relative">
        <div
          className="absolute inset-0 lg:hidden block  pointer-events-none"
          style={{
            background:
              "linear-gradient(145deg, #7c6ef7 0%, #9b8df9 50%, #b3a6fb 100%)",
          }}
        ></div>

        {/* logo */}
        <div className="lg:hidden lg:mb-8 mb-0 flex flex-col items-center gap-2 z-20">
          <img
            src={IMAGE_HELPER.WhiteLogo}
            alt="D Media"
            className="h-14 object-contain"
          />
        </div>
        <div className="hidden lg:mb-8 mb-0 lg:flex flex-col items-center gap-2 z-20">
          <img
            src={IMAGE_HELPER.Dlogo}
            alt="D Media"
            className="h-14 object-contain"
          />
        </div>
        <div className="mt-0 text-center">
          <h1 className="!text-white text-4xl font-extrabold leading-tight mt-1 drop-shadow-sm">
            Job Sheet.
          </h1>
          <p className="!text-white text-xl  font-thin leading-tight  drop-shadow-sm">
            Track · Assign · Deliver
          </p>
        </div>
        {/* heading */}
        <div className="text-center lg:mb-8 mb-0">
          <h2 className="hidden lg:block text-3xl font-bold lg:text-gray-900 text-white tracking-tight">
            Sign in to Continue
          </h2>
        </div>

        {/* form card */}
        <div className="w-full   max-w-sm">
          <Form
            form={form}
            name="login"
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
            className="space-y-1"
          >
            {/* Email */}
            <Form.Item
              name="email"
              label={
                <span className="text-sm font-semibold lg:text-gray-700 text-white">
                  Email
                </span>
              }
              rules={[EmailValidation("Enter Email")]}
            >
              <Input
                placeholder="Enter your Email here"
                disabled={loading}
                className="!h-12 !rounded-xl !bg-gray-100 !border-0 !text-gray-700 placeholder:text-gray-400 focus:!ring-2 focus:!ring-indigo-400"
              />
            </Form.Item>

            {/* Password */}
            <Form.Item
              name="password"
              label={
                <span className="text-sm font-semibold lg:text-gray-700 text-white">
                  Password
                </span>
              }
              rules={[PasswordValidation("Enter Password")]}
            >
              <Input.Password
                placeholder="Enter your Password here"
                disabled={loading}
                className="!h-12 !rounded-xl !bg-gray-100 !border-0 !text-gray-700 placeholder:text-gray-400 focus:!ring-2 focus:!ring-indigo-400"
              />
            </Form.Item>

            {/* Remember me */}
            <Form.Item
              name="remember"
              valuePropName="checked"
              className="!mb-2"
            >
              <Checkbox
                disabled={loading}
                className="lg:text-gray-500 !text-white text-sm"
              >
                Remember me
              </Checkbox>
            </Form.Item>

            {/* Submit */}
            <Form.Item className="!mt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold text-white text-base
                           transition-all duration-200 active:scale-95
                           disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "#6364f0",
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing In…
                  </span>
                ) : (
                  "Login"
                )}
              </button>
            </Form.Item>
          </Form>

          {/* footer link */}
        
        </div>
        <div className="lg:hidden block">
          <img
            src={IMAGE_HELPER.LOGIN_IMAGE}
            alt="Job Sheet 3D illustration"
            className="w-full object-contain drop-shadow-xl lg:mt-10 mt-0"
          />
        </div>

        {/* mobile hero (shown only on small screens) */}
        {/* <div className="lg:hidden mt-10 w-full max-w-xs mx-auto">
          <img
            src={heroImage}
            alt="Job Sheet 3D illustration"
            className="w-full object-contain drop-shadow-xl"
          />
        </div> */}
      </div>

      {/* ── global float keyframe (Tailwind JIT arbitrary) ──────────────────
          Add this to your global CSS if the tailwind arbitrary value below
          doesn't fire in your config:

          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50%       { transform: translateY(-14px); }
          }
      ──────────────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-14px); }
        }
      `}</style>
    </div>
  );
};

export default Login;
