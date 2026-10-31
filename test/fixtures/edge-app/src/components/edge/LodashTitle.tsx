import _ from "lodash";
import { startCase } from "lodash";
export default function LodashTitle() { return <h3>{_.capitalize("lodash")} {startCase("start-case-works")}</h3>; }
