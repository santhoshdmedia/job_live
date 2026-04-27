import { Button, Checkbox, Form, Input, message } from "antd";
import { LabelHelper } from "../components/LabelHelper";
import { EmailValidation, formValidation, PasswordValidation } from "../helper/formvalidation";
import { useEffect, useState } from "react";
import { login } from "../api";
import _ from "lodash";
import { admintoken, ERROR_NOTIFICATION, SUCCESS_NOTIFICATION } from "../helper/notification_helper";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { isLoginSuccess } from "../redux/slices/authSlice";

const Login = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const result = await login(values);
      if (_.isEmpty(_.get(result, "data.data", []))) {
        return ERROR_NOTIFICATION("Invalid credentials");
      }
      dispatch(isLoginSuccess(_.get(result, "data.data", {})));
      localStorage.setItem(admintoken, _.get(result, "data.data.token", ""));
      localStorage.setItem("userprofile",JSON.stringify(_.get(result,"data.data","")))
      SUCCESS_NOTIFICATION(result);
      
      // Animation before navigation
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
    if (localStorage.getItem(admintoken)) {
      navigate("/dashboard");
    }
    
    // Welcome message animation timer
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 2500);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-white min- overflow-hidden ">
      <div className="flex flex-col lg:flex-row ">
     

        {/* Right Section - Form */}
        <div 
          className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white"
        >
          <div className="w-full max-w-md">
            <div
              className="mb-8 text-center"
            >
              <h1 className="text-3xl font-bold text-primary mb-2">Adventure Starts Here</h1>
              <p className="text-gray-600">Make your app management easy and fun!</p>
            </div>

            <Form 
              onFinish={onFinish} 
              name="login" 
              layout="vertical" 
              className="w-full !lowercase"
              form={form} 
              requiredMark={false}

            >
              <div
              >
                <Form.Item 
                  name="email" 
                  label={<LabelHelper title={"Email"} />} 
                  rules={[EmailValidation("Enter Email")]}
                >
                  <Input 
                    placeholder="Enter Email" 
                    className="h-12 rounded-lg !lowercase"
                    disabled={loading}
                  />
                </Form.Item>
              </div>

              <div
              >
                <Form.Item 
                  name="password" 
                  label={<LabelHelper title={"Password"} />} 
                  rules={[PasswordValidation("Enter Password")]}
                >
                  <Input.Password 
                    placeholder="Enter Password" 
                    className="h-12 rounded-lg"
                    disabled={loading}
                  />
                </Form.Item>
              </div>

              <div
                className="mb-4"
              >
                <Form.Item name="remember" valuePropName="checked">
                  <Checkbox disabled={loading}>Remember me</Checkbox>
                </Form.Item>
              </div>

              <div
              >
                <Form.Item>
                  <Button 
                    htmlType="submit" 
                    className="w-full h-12 rounded-lg bg-primary text-white font-semibold border-none"
                    disabled={loading}
                  >
                    login
                    {/* <AnimatePresence mode="wait">
                      {loading ? (
                        <span
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-center"
                        >
                          <span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"
                          />
                          Signing In...
                        </span>
                      ) : (
                        <span
                          key="login-text"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          Sign In
                        </span>
                      )}
                    </AnimatePresence> */}
                  </Button>
                </Form.Item>
              </div>
            </Form>

            
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;