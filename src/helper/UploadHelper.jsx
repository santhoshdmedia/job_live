import { message, Skeleton, Upload } from "antd";
import { uploadImage } from "../api";
import _ from "lodash";
import { ICON_HELPER } from "./iconhelper";
import { useState } from "react";

const UploadHelper = (props) => {
  const { setImagePath, image_path, multiple, max, field_key, blog, current_key, handleChange } = props;
  const [loading, setLoading] = useState(false);

  const imageValidation = {
    beforeUpload: (file) => {
      setLoading(true);
      const isImage = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type);
      if (!isImage) {
        message.warning(`${file.name} is not supported`);
        setLoading(false);
      }
      return isImage || Upload.LIST_IGNORE;
    },
    onChange: async (info) => {
      setLoading(true);

      try {
        if (_.get(info, "file.status", "") === "uploading") {
          const formData = new FormData();
          formData.append("image", info.file.originFileObj);
          const result = await uploadImage(formData);
          const uploadedUrl = _.get(result, "data.data.url", "");

          if (blog) {
            return handleChange(current_key, uploadedUrl);
          }

          if (uploadedUrl) {
            if (Number(field_key)) {
              setImagePath([
                ...image_path,
                {
                  key: image_path?.length + 1,
                  path: uploadedUrl,
                  field_key,
                },
              ]);
            } else {
              multiple
                ? setImagePath([
                    ...image_path,
                    {
                      key: image_path?.length + 1,
                      path: uploadedUrl,
                    },
                  ])
                : setImagePath(uploadedUrl);
            }
          }
          message.success("Image uploaded successfully!");
        }
      } catch (err) {
        console.log(err);
        message.error("Failed to upload image. Please try again.");
      } finally {
        setLoading(false);
      }
    },
  };

  return (
    <Skeleton loading={loading} active>
      <Upload.Dragger {...imageValidation} maxCount={max || 1} showUploadList={false} style={{ width: 100, background: "white", height: 100 }}>
        <div className={`!w-full !h-[60px] !center_div ${blog && "!w-[100px] !h-[100px]"}`}>
          <ICON_HELPER.UPLOAD_ICON />
        </div>
      </Upload.Dragger>
    </Skeleton>
  );
};

export default UploadHelper;
