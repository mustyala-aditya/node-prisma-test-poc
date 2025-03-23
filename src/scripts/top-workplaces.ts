import axios, { AxiosResponse } from 'axios';
import { Workplace, Shift, Worker } from '@prisma/client'; 
import { FinalResponse } from 'src/models/finalResponse';
import { APIResponse } from 'src/models/apiResponse';

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

/**
 * Generic function to fetch data from API
 * @param endpoint 
 * @returns An array of API response data
 */
async function getAPIResponse<T>(endpoint:string): Promise<T[]> {
    let objects:T[] = [];
    let nextUrl: string | undefined = `${baseUrl}/${endpoint}`;
  
    while (nextUrl) {
      const response:AxiosResponse<APIResponse<T>> = await axios.get<APIResponse<T>>(nextUrl);
      const data = response.data;
      objects = objects.concat(data.data);
      nextUrl = data.links.next;
    }
    return objects;
}
/**
 * Determines if shift is valid and completed
 * @param shift 
 * @param activeWorkerIds 
 * @param activeWorkplacesIds 
 * @returns A boolean value indicating whether the shift is completed
 */
function isCompletedShift(shift: Shift, activeWorkerIds: Set<number>,activeWorkplacesIds: Set<number>): boolean {
    return (
      shift.workerId !== null &&
      shift.cancelledAt === null &&
      activeWorkerIds.has(shift.workerId) &&
      activeWorkplacesIds.has(shift.workplaceId)
    );
}

/**
 * Calculated the top 3 active workplaces based on completed shifts count
 * @returns An array with sorted workplaces based on shifts
 */
async function getTopWorkplaces(): Promise<FinalResponse[]>{
    try {
        const workplaces = await getAPIResponse<Workplace>('workplaces');
        const activeWorkplaces = workplaces.filter((workplace:Workplace) => workplace.status == 0);
        const activeWorkplacesIds = new Set<number>(activeWorkplaces.map((workplace:Workplace) => workplace.id));

        const shifts = await getAPIResponse<Shift>('shifts');

        const workers = await getAPIResponse<Worker>('workers');
        const activeWorkers = workers.filter((worker:Worker) => worker.status === 0);
        const activeWorkerIds = new Set<number>(activeWorkers.map((worker:Worker) => worker.id));

        const completedShifts:Shift[] = shifts.filter((shift:Shift) =>
        isCompletedShift(shift, activeWorkerIds,activeWorkplacesIds)
        );

        const workplaceShiftCount: Record<number, number> = {};
        completedShifts.forEach((shift:Shift) => {
            workplaceShiftCount[shift.workplaceId] = (workplaceShiftCount[shift.workplaceId] || 0) + 1;
        })

        const workplacesNameWithCount:FinalResponse[] = activeWorkplaces.map((workplace:Workplace) => ({
        name : workplace.name,
        shifts: workplaceShiftCount[workplace.id] || 0,
        }));

        workplacesNameWithCount.sort((a:any, b:any) => b.shifts - a.shifts);

        return workplacesNameWithCount.slice(0, 3);
    } catch (error) {
      console.error('Error fetching top workplaces:', error);
      throw error;
    }
}

(async () => {
    try {
      let topWorkplaces = await getTopWorkplaces();
      console.log(topWorkplaces);
    } catch (error) {
      console.error('An error occurred while retrieving top workplaces:', error);
    }
  })();