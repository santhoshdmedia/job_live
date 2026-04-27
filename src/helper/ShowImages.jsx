import { Image } from "antd";
import { MdOutlineDeleteSweep } from "react-icons/md";

const ShowImages = ({ path, setImage, multiple, field_key }) => {
  const handleChange = (url) => {
    if (multiple) {
      setImage(path.filter((res) => res.key !== url));
    } else {
      setImage("");
    }
  };

  const ImageView = ({ url, id }) => (
    <div className="flex items-end gap-x-1 relative">
      <Image src={url} alt="category_image" className="!w-[100px] !h-[100px] object-cover border rounded-lg" />
      <div className="absolute -top-1 right-0 size-[25px] center_div rounded-l-lg bg-white">
        <MdOutlineDeleteSweep onClick={() => handleChange(id)} className="cursor-pointer text-xl text-primary_color" />
      </div>
    </div>
  );

  return <div className={`flex flex-wrap gap-y-2 ${multiple ? "gap-x-4" : "gap-x-2"} items-end`}>{multiple ? path?.map((res, index) => (Number(field_key) ? Number(res?.field_key) === Number(field_key) && <ImageView url={res?.path} id={res?.key} key={index} /> : <ImageView url={res?.path} id={res?.key} key={index} />)) : <ImageView url={path} />}</div>;
};

export default ShowImages;
